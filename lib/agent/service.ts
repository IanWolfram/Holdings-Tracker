import fs from "fs";
import path from "path";
import { getPositions } from "../etrade";
import { fetchCompanyProfile } from "../company-profile";
import { getServices } from "@/src/registry";
import { analyzeStory, callMlxRaw, UnifiedAnalysis } from "../../world-brain/brain";
import { getRecentVaultStories, runLearningPass } from "../../world-brain/learn";
import {
  resolveEligiblePredictions,
  appendPrediction,
  getRecentResolvedPredictions,
} from "../../world-brain/predictions";
import { ensureMlxServer } from "../mlx";
import { writeStoryNote, writeDailySummary } from "../../world-brain/obsidian";
import { WORLD_VAULT_PATH, resolveVaultPath } from "../constants";
import { getQuote } from "../market-data";
import { getActiveModel } from "../ai-config";
import type { GeoStory, WorldData } from "@/types/geo.types";
import type { ClassifiedStory } from "@/types/news.types";
import type {
  TickerPrediction,
  PredictionDirection,
} from "@/types/predictions";

export interface AgentProgress {
  status: "idle" | "running" | "complete" | "error";
  phase?: "resolving" | "analyzing" | "forecasting" | "learning";
  ticker?: string;
  currentHeadline?: string;
  articleIndex?: number;
  totalArticles?: number;
  message?: string;
  streamText?: string;
  results?: AgentRunResult;
  isMock?: boolean;
}

export interface TickerResult {
  ticker: string;
  verdicts: {
    verdict: string;
    headline: string;
    url: string;
    analysis: UnifiedAnalysis;
  }[];
}

export interface AgentRunResult {
  totalBuys: number;
  totalSells: number;
  totalHolds: number;
  tickerResults: TickerResult[];
  startedAt: number;
  finishedAt: number;
}

// Global state for progress tracking across API calls
let currentProgress: AgentProgress = { status: "idle" };
let isCancelled = false;

export function getAgentProgress(): AgentProgress {
  return currentProgress;
}

export function cancelStockAgent(): void {
  if (currentProgress.status === "running") {
    isCancelled = true;
    currentProgress = { status: "idle", message: "Agent run cancelled." };
  }
}

async function runForecast(
  ticker: string,
  currentPrice: number,
  verdicts: TickerResult["verdicts"],
  tickerContext: string | undefined,
  vaultPath: string,
  sector: string | undefined,
  runAt: number
): Promise<TickerPrediction | null> {
  let forecasterPrompt = "";
  try {
    forecasterPrompt = fs
      .readFileSync(path.join(process.cwd(), "world-brain", "agents", "FORECASTER.md"), "utf-8")
      .trim();
  } catch {
    return null;
  }
  if (!forecasterPrompt) return null;

  const catalysts = verdicts.slice(0, 5).map((v) => ({
    headline: v.headline.slice(0, 100),
    verdict: v.verdict,
    confidence: v.analysis.confidence,
  }));

  const recentResolved = getRecentResolvedPredictions(vaultPath, ticker, 3);

  const verdictsBlock = verdicts
    .slice(0, 5)
    .map(
      (v) =>
        `- ${v.verdict} (${Math.round(v.analysis.confidence * 100)}%) — "${v.headline.slice(0, 80)}"\n  Reason: ${(v.analysis.reason ?? "").slice(0, 120)}`
    )
    .join("\n");

  const calibrationBlock =
    recentResolved.length > 0
      ? "\n\nYour recent resolved predictions for this ticker:\n" +
        recentResolved
          .map((p, i) => {
            const sign = (p.actualPct ?? 0) >= 0 ? "+" : "";
            return `${i + 1}. [${new Date(p.runAt).toISOString().slice(0, 10)}] Predicted ${p.direction} +/-${p.magnitudePct}% (conf ${Math.round(p.confidence * 100)}%) → ${p.outcome} (actual ${sign}${p.actualPct?.toFixed(1) ?? "?"}%)`;
          })
          .join("\n")
      : "";

  const userMessage =
    `Ticker: ${ticker}\nCurrent price: $${currentPrice.toFixed(2)}\n` +
    (sector ? `Sector: ${sector}\n` : "") +
    `\nSession verdicts:\n${verdictsBlock}` +
    (tickerContext ? `\n\nTicker Knowledge:\n${tickerContext.slice(0, 400)}` : "") +
    calibrationBlock +
    `\n\nOUTPUT ONLY THE JSON OBJECT. NO MARKDOWN. START WITH { END WITH }.`;

  const raw = await callMlxRaw(forecasterPrompt, userMessage);
  if (!raw) return null;

  try {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return null;
    const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as {
      direction?: string;
      magnitudePct?: number;
      confidence?: number;
      reasoning?: string;
    };
    if (!parsed.direction || !["UP", "DOWN", "FLAT"].includes(parsed.direction)) return null;

    const active = getActiveModel();
    return {
      id: `${ticker}-${runAt}`,
      ticker,
      runAt,
      priceAtPrediction: currentPrice,
      direction: parsed.direction as PredictionDirection,
      magnitudePct:
        typeof parsed.magnitudePct === "number"
          ? Math.max(0, Math.min(30, parsed.magnitudePct))
          : 0,
      horizonDays: 7,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
      reasoning: parsed.reasoning ?? "",
      catalysts,
      engine: active.id,
      status: "pending",
    };
  } catch {
    console.warn(`[agent] FORECASTER parse failed for ${ticker}`);
    return null;
  }
}

export async function runStockAgent(): Promise<AgentRunResult> {
  if (process.env.ETRADE_ENV === "mock") {
    throw new Error("Stock Agent is disabled in mock mode. Please switch to 'live' to run deep intelligence.");
  }

  if (currentProgress.status === "running") {
    throw new Error("An agent run is already in progress.");
  }

  isCancelled = false;
  currentProgress = { status: "running", message: "Ensuring AI Brain is awake..." };
  await ensureMlxServer();

  currentProgress = { ...currentProgress, message: "Fetching live positions..." };
  const startedAt = Date.now();

  try {
    // 1. Fetch live positions
    console.log(`\x1b[1m\x1b[36m[agent] Starting Deep Intelligence Sweep...\x1b[0m`);
    const positions = await getPositions();
    const holdingTickers = positions.map((p) => p.ticker);
    console.log(`\x1b[2m[agent] Identified ${positions.length} active positions.\x1b[0m`);

    // 2. Fetch profiles and sectors
    currentProgress = { ...currentProgress, message: "Fetching company profiles..." };
    const profiles: Record<string, any> = {};
    for (const p of positions) {
      const prof = await fetchCompanyProfile(p.ticker);
      if (prof) profiles[p.ticker] = prof;
    }

    const holdingSectors = [
      ...new Set(
        Object.values(profiles)
          .map((p) => p?.sector)
          .filter((s): s is string => Boolean(s))
      ),
    ];

    const tickerResults: TickerResult[] = [];
    const allGeoStories: GeoStory[] = [];
    let totalBuys = 0;
    let totalSells = 0;
    let totalHolds = 0;

    // Invalidate news cache for all tickers before starting so vault-stored verdicts
    // are picked up via findInVault on fresh fetch — enables correct resume after cancel.
    for (const p of positions) {
      getServices().newsService.invalidateTicker(p.ticker);
    }

    // 3a. Resolve any pending predictions whose horizon has passed
    const quoteCache: Record<string, Awaited<ReturnType<typeof getQuote>>> = {};
    if (WORLD_VAULT_PATH) {
      currentProgress = { ...currentProgress, phase: "resolving", message: "Resolving prior predictions..." };
      for (const pos of positions) {
        try {
          const quote = await getQuote(pos.ticker);
          quoteCache[pos.ticker] = quote;
          resolveEligiblePredictions(WORLD_VAULT_PATH, pos.ticker, quote?.currentPrice ?? null, startedAt);
        } catch {
          // non-fatal — prediction resolution never blocks analysis
        }
      }
    }

    // 3b. Analyze news per ticker
    for (const pos of positions) {
      if (isCancelled) break;
      
      currentProgress = {
        ...currentProgress,
        phase: "analyzing",
        ticker: pos.ticker,
        currentHeadline: undefined,
        message: `Fetching news for ${pos.ticker}...`
      };

      // Use the same unified NewsService the dashboard uses — it has the cache and prior verdicts
      const articles = await getServices().newsService.getNewsForTicker(pos.ticker, profiles[pos.ticker]?.sector);
      // Filter to only articles not yet run through the brain, then cap at 5.
      // Filtering before slicing ensures previously-analyzed articles don't block new ones.
      const top = articles.filter(a => a.isAnalyzed !== true).slice(0, 10);

      // Load per-ticker learned context and few-shot examples from vault
      let tickerContext: string | undefined;
      let recentVerdicts: Array<{ headline: string; verdict: string; confidence: number; reason: string }> | undefined;
      if (WORLD_VAULT_PATH) {
        const resolvedVault = resolveVaultPath(WORLD_VAULT_PATH)!;
        try {
          const raw = fs.readFileSync(path.join(resolvedVault, `${pos.ticker}.md`), "utf-8");
          const body = raw.match(/^---[\s\S]*?---\s*([\s\S]*)$/)?.[1]?.trim() ?? "";
          const prose = body.replace(/^#.*\n/, "").trim();
          if (prose) tickerContext = prose.slice(0, 600);
        } catch { /* stub is empty or missing */ }

        const stories = getRecentVaultStories(pos.ticker, WORLD_VAULT_PATH, 3);
        if (stories.length > 0) recentVerdicts = stories;
      }

      const verdicts: TickerResult["verdicts"] = [];

      for (let i = 0; i < top.length; i++) {
        if (isCancelled) break;

        const article = top[i];

        currentProgress = {
          ...currentProgress,
          ticker: pos.ticker,
          articleIndex: i + 1,
          totalArticles: top.length,
          currentHeadline: article.headline,
          message: `Analyzing: ${article.headline.slice(0, 40)}...`,
          streamText: "" // Reset stream text for the next story
        };

        const analysis = await analyzeStory(
          pos.ticker,
          article.headline,
          article.summary ?? "",
          holdingTickers,
          holdingSectors,
          (chunk) => {
            currentProgress.streamText = chunk;
          },
          tickerContext,
          recentVerdicts
        );

        verdicts.push({
          verdict: analysis.verdict,
          headline: article.headline,
          url: article.url,
          analysis
        });

        if (analysis.verdict === "BUY") totalBuys++;
        else if (analysis.verdict === "SELL") totalSells++;
        else totalHolds++;
        
        if (WORLD_VAULT_PATH) {
          const profile = profiles[pos.ticker];
          const geoStory: GeoStory = {
            ticker: pos.ticker,
            headline: article.headline,
            summary: article.summary ?? "",
            url: article.url,
            datetime: article.datetime,
            verdict: analysis.verdict,
            confidence: analysis.confidence,
            reason: analysis.reason,
            source: article.source,
            originCountryCode: analysis.originCountryCode ?? profile?.countryCode,
            relevanceScore: analysis.relevanceScore,
            isAnalyzed: Boolean(analysis.reason), // false if MLX returned a fallback (empty reason)
          };
          allGeoStories.push(geoStory);
          writeStoryNote(geoStory, WORLD_VAULT_PATH, profile?.sector);
          // Patch the cached entry in-place so the terminal sees the new verdict
          // immediately without busting the full ticker cache (which causes slow reloads).
          getServices().newsService.patchCachedStory(pos.ticker, article.url, {
            verdict: analysis.verdict as ClassifiedStory["verdict"],
            confidence: analysis.confidence,
            reason: analysis.reason ?? undefined,
            isAnalyzed: true,
            classifiedAt: new Date().toISOString(),
          });
        }
      }

      // Forecast: synthesize this ticker's verdicts into a 7-day directional prediction
      if (WORLD_VAULT_PATH && verdicts.length > 0 && !isCancelled) {
        currentProgress = {
          ...currentProgress,
          phase: "forecasting",
          message: `Forecasting ${pos.ticker}...`,
        };
        try {
          const quote = quoteCache[pos.ticker] ?? (await getQuote(pos.ticker));
          if (quote?.currentPrice) {
            const prediction = await runForecast(
              pos.ticker,
              quote.currentPrice,
              verdicts,
              tickerContext,
              WORLD_VAULT_PATH,
              profiles[pos.ticker]?.sector,
              startedAt
            );
            if (prediction) {
              appendPrediction(WORLD_VAULT_PATH, prediction);
              console.log(`[agent] Forecast for ${pos.ticker}: ${prediction.direction} +/-${prediction.magnitudePct}% (conf ${Math.round(prediction.confidence * 100)}%)`);
            }
          }
        } catch (err) {
          console.error(`[agent] Forecast failed for ${pos.ticker} (non-fatal):`, err);
        }
      }

      tickerResults.push({ ticker: pos.ticker, verdicts });
    }
    
    if (WORLD_VAULT_PATH && allGeoStories.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const dummyWorldData = { profiles, countries: {}, fetchedAt: Date.now() } as unknown as WorldData;
      writeDailySummary(today, allGeoStories, WORLD_VAULT_PATH, dummyWorldData);
    }

    const result: AgentRunResult = {
      totalBuys,
      totalSells,
      totalHolds,
      tickerResults,
      startedAt,
      finishedAt: Date.now()
    };
    
    if (isCancelled) {
      console.log(`\x1b[1m\x1b[33m[agent] Sweep cancelled.\x1b[0m`);
      return result;
    }

    console.log(`\x1b[1m\x1b[32m[agent] Sweep complete.\x1b[0m ${totalBuys} BUYS, ${totalSells} SELLS, ${totalHolds} HOLDS.`);

    // Learning pass: synthesize session verdicts into per-ticker knowledge files and market-insights.md
    if (WORLD_VAULT_PATH) {
      currentProgress = { ...currentProgress, phase: "learning", message: "Synthesizing session insights into knowledge base..." };
      try {
        await runLearningPass(result, WORLD_VAULT_PATH, profiles);
      } catch (err) {
        console.error("[agent] Learning pass failed (non-fatal):", err);
      }
    }

    currentProgress = { status: "complete", results: result };
    return result;
  } catch (err) {
    console.error(`\x1b[1m\x1b[31m[agent] Fatal error:\x1b[0m`, err);
    currentProgress = { status: "error", message: (err as Error).message };
    throw err;
  }
}
