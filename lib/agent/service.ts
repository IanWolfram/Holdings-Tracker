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
  loadPredictions,
  SUPPORTED_HORIZONS,
} from "../../world-brain/predictions";
import { updateCalibration } from "../../world-brain/calibration";
import { classifyCatalystTypes } from "../../world-brain/catalyst-classifier";
import { ensureMlxServer } from "../mlx";
import {
  writeStoryNote,
  writeDailySummary,
  writeMacroSnapshot,
  writeEventsSnapshot,
} from "../../world-brain/obsidian";
import { WORLD_VAULT_PATH, resolveVaultPath } from "../constants";
import { getQuote as getCoreQuote } from "../market-data";
import { getQuote as getMarketQuote } from "../marketdata/prices";
import { getMacroSnapshot, type MacroSnapshot } from "../marketdata/macro";
import {
  getEventsSnapshot,
  getUpcomingEarnings,
  type EventsSnapshot,
} from "../marketdata/events";
import { runAlertsPass } from "../../world-brain/alerts";
import { getActiveModel } from "../ai-config";
import type { GeoStory, WorldData } from "@/types/geo.types";
import type { ClassifiedStory } from "@/types/news.types";
import type {
  CatalystType,
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

function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
}

function summarizeMacroForPrompt(snapshot?: MacroSnapshot | null): string {
  if (!snapshot) return "";
  return [
    "\n\nMarket State:",
    `VIX: ${formatNumber(snapshot.vix)} | 10Y: ${formatNumber(snapshot.tenY)}% | DXY: ${formatNumber(snapshot.dxy)} | Regime: ${snapshot.regime}`,
    snapshot.summary,
  ].join("\n");
}

function uniqueCatalystTypes(types: CatalystType[]): CatalystType[] {
  return [...new Set(types)];
}

async function runForecast(
  ticker: string,
  currentPrice: number,
  verdicts: TickerResult["verdicts"],
  tickerContext: string | undefined,
  vaultPath: string,
  sector: string | undefined,
  runAt: number,
  macroSnapshot: MacroSnapshot | null,
  horizonDays: number,
  daysUntilEarnings?: number | null
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
    catalystTypes: classifyCatalystTypes({
      headline: v.headline,
      reason: v.analysis.reason,
      verdict: v.verdict,
    }),
  }));
  const predictionCatalystTypes = uniqueCatalystTypes(
    catalysts.flatMap((catalyst) => catalyst.catalystTypes ?? [])
  );

  // Self-calibration block uses outcomes from the same horizon — a 30-day
  // forecaster should learn from prior 30-day outcomes, not 7-day ones.
  const recentResolved = getRecentResolvedPredictions(vaultPath, ticker, 3, horizonDays);

  const verdictsBlock = verdicts
    .slice(0, 5)
    .map(
      (v) =>
        `- ${v.verdict} (${Math.round(v.analysis.confidence * 100)}%) — "${v.headline.slice(0, 80)}"\n  Reason: ${(v.analysis.reason ?? "").slice(0, 120)}`
    )
    .join("\n");

  const calibrationBlock =
    recentResolved.length > 0
      ? `\n\nYour recent resolved ${horizonDays}d predictions for this ticker:\n` +
        recentResolved
          .map((p, i) => {
            const sign = (p.actualPct ?? 0) >= 0 ? "+" : "";
            return `${i + 1}. [${new Date(p.runAt).toISOString().slice(0, 10)}] Predicted ${p.direction} +/-${p.magnitudePct}% (conf ${Math.round(p.confidence * 100)}%) → ${p.outcome} (actual ${sign}${p.actualPct?.toFixed(1) ?? "?"}%)`;
          })
          .join("\n")
      : "";

  const earningsHint =
    typeof daysUntilEarnings === "number" && daysUntilEarnings >= 0 && daysUntilEarnings <= 7
      ? `\nEarnings in ${daysUntilEarnings} day${daysUntilEarnings === 1 ? "" : "s"} — widen magnitude bands and treat this window as higher-variance. Bias confidence down unless catalysts are unambiguous.`
      : "";

  const userMessage =
    `Ticker: ${ticker}\nCurrent price: $${currentPrice.toFixed(2)}\n` +
    `Target horizon: ${horizonDays} day${horizonDays === 1 ? "" : "s"}\n` +
    (sector ? `Sector: ${sector}\n` : "") +
    summarizeMacroForPrompt(macroSnapshot) +
    earningsHint +
    `\nSession verdicts:\n${verdictsBlock}` +
    (tickerContext ? `\n\nTicker Knowledge:\n${tickerContext.slice(0, 400)}` : "") +
    calibrationBlock +
    `\n\nForecast for the ${horizonDays}-day horizon. OUTPUT ONLY THE JSON OBJECT. NO MARKDOWN. START WITH { END WITH }.`;

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
      id: `${ticker}-${horizonDays}d-${runAt}`,
      ticker,
      runAt,
      priceAtPrediction: currentPrice,
      direction: parsed.direction as PredictionDirection,
      magnitudePct:
        typeof parsed.magnitudePct === "number"
          ? Math.max(0, Math.min(30, parsed.magnitudePct))
          : 0,
      horizonDays,
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
      reasoning: parsed.reasoning ?? "",
      catalysts,
      catalystTypes:
        predictionCatalystTypes.length > 0 ? predictionCatalystTypes : ["other"],
      engine: active.id,
      status: "pending",
    };
  } catch {
    console.warn(`[agent] FORECASTER parse failed for ${ticker} @ ${horizonDays}d`);
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

    let macroSnapshot: MacroSnapshot | null = null;
    let eventsSnapshot: EventsSnapshot | null = null;
    const runDate = new Date(startedAt).toISOString().split("T")[0];

    currentProgress = { ...currentProgress, message: "Loading macro and event context..." };
    try {
      macroSnapshot = await getMacroSnapshot();
    } catch {
      macroSnapshot = null;
    }
    try {
      eventsSnapshot = await getEventsSnapshot(holdingTickers, new Date(startedAt));
    } catch {
      eventsSnapshot = null;
    }

    if (WORLD_VAULT_PATH) {
      if (macroSnapshot) {
        writeMacroSnapshot(runDate, macroSnapshot, WORLD_VAULT_PATH);
      }
      if (eventsSnapshot) {
        writeEventsSnapshot(runDate, eventsSnapshot, WORLD_VAULT_PATH);
      }
    }

    // Pre-earnings boost: fetch a single 14-day earnings window so each ticker
    // forecast can flag "earnings imminent" without re-querying Finnhub per call.
    let upcomingEarnings = new Map<string, number>();
    try {
      upcomingEarnings = await getUpcomingEarnings(holdingTickers, new Date(startedAt), 14);
    } catch {
      upcomingEarnings = new Map();
    }

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
    const quoteCache: Partial<Record<string, Awaited<ReturnType<typeof getCoreQuote>>>> = {};
    const marketQuoteCache: Partial<Record<string, Awaited<ReturnType<typeof getMarketQuote>>>> = {};
    let resolvedCount = 0;
    if (WORLD_VAULT_PATH) {
      currentProgress = { ...currentProgress, phase: "resolving", message: "Resolving prior predictions..." };
      for (const pos of positions) {
        try {
          const quote = await getCoreQuote(pos.ticker);
          quoteCache[pos.ticker] = quote;
          const resolved = resolveEligiblePredictions(
            WORLD_VAULT_PATH,
            pos.ticker,
            quote?.currentPrice ?? null,
            startedAt
          );
          resolvedCount += resolved.resolved;
        } catch {
          // non-fatal — prediction resolution never blocks analysis
        }
      }

      if (resolvedCount > 0) {
        try {
          updateCalibration(WORLD_VAULT_PATH);
        } catch (err) {
          console.error("[agent] Calibration update failed (non-fatal):", err);
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

      if (marketQuoteCache[pos.ticker] === undefined) {
        try {
          marketQuoteCache[pos.ticker] = await getMarketQuote(pos.ticker);
        } catch {
          marketQuoteCache[pos.ticker] = null;
        }
      }
      const tickerMarketQuote = marketQuoteCache[pos.ticker];

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
          recentVerdicts,
          {
            macro: macroSnapshot
              ? {
                  vix: macroSnapshot.vix,
                  tenY: macroSnapshot.tenY,
                  dxy: macroSnapshot.dxy,
                  regime: macroSnapshot.regime,
                  summary: macroSnapshot.summary,
                }
              : undefined,
            tickerState: tickerMarketQuote
              ? {
                  price: tickerMarketQuote.price,
                  change1d: tickerMarketQuote.change1d,
                  change5d: tickerMarketQuote.change5d,
                  change30d: tickerMarketQuote.change30d,
                  return52wHigh: tickerMarketQuote.return52wHigh,
                  rsi14: tickerMarketQuote.rsi14,
                  atr14: tickerMarketQuote.atr14,
                }
              : undefined,
          }
        );

        const catalystTypes = classifyCatalystTypes({
          headline: article.headline,
          summary: article.summary ?? "",
          reason: analysis.reason,
          verdict: analysis.verdict,
        });

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
            catalystTypes,
          };
          allGeoStories.push(geoStory);
          writeStoryNote(geoStory, WORLD_VAULT_PATH, profile?.sector);
          // Patch the cached entry in-place so the terminal sees the new verdict
          // immediately without busting the full ticker cache (which causes slow reloads).
          getServices().newsService.patchCachedStory(pos.ticker, article.url, {
            verdict: analysis.verdict as ClassifiedStory["verdict"],
            confidence: analysis.confidence,
            reason: analysis.reason ?? undefined,
            catalystTypes,
            isAnalyzed: true,
            classifiedAt: new Date().toISOString(),
          });
        }
      }

      // Forecast: synthesize this ticker's verdicts into directional predictions
      // at multiple horizons (1d, 7d, 30d). Each horizon is gated independently
      // so a 9am 1d forecast doesn't block the same day's 7d/30d forecasts.
      if (WORLD_VAULT_PATH && verdicts.length > 0 && !isCancelled) {
        currentProgress = {
          ...currentProgress,
          phase: "forecasting",
          message: `Forecasting ${pos.ticker}...`,
        };
        try {
          const quote = quoteCache[pos.ticker] ?? (await getCoreQuote(pos.ticker));
          const tickerMarketQuote = marketQuoteCache[pos.ticker] ?? null;
          const currentPrice = quote?.currentPrice ?? tickerMarketQuote?.price ?? null;
          if (currentPrice !== null) {
            // All three horizons refresh on a daily cadence so new information
            // updates the 30d view before its full window elapses; the horizon
            // only controls when an outstanding prediction is *resolved* against
            // realized price, not how often a new one is issued.
            const dailyCutoff = startedAt - 86_400_000;
            for (const horizon of SUPPORTED_HORIZONS) {
              if (isCancelled) break;
              const existing = loadPredictions(WORLD_VAULT_PATH, pos.ticker, horizon);
              const recentPrediction = existing.find((p) => p.runAt >= dailyCutoff);
              if (recentPrediction) {
                console.log(
                  `[agent] Skipping ${horizon}d forecast for ${pos.ticker} — predicted on ${new Date(recentPrediction.runAt).toDateString()}`
                );
                continue;
              }
              const daysUntilEarnings = upcomingEarnings.get(pos.ticker.toUpperCase());
              const prediction = await runForecast(
                pos.ticker,
                currentPrice,
                verdicts,
                tickerContext,
                WORLD_VAULT_PATH,
                profiles[pos.ticker]?.sector,
                startedAt,
                macroSnapshot,
                horizon,
                daysUntilEarnings
              );
              if (prediction) {
                appendPrediction(WORLD_VAULT_PATH, prediction);
                console.log(
                  `[agent] ${horizon}d forecast for ${pos.ticker}: ${prediction.direction} +/-${prediction.magnitudePct}% (conf ${Math.round(prediction.confidence * 100)}%)`
                );
              }
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

      // Alerts pass runs AFTER the learning pass so sector breadth / correlation
      // artifacts are fresh when we compute contradictions, anomalies, and sizing.
      try {
        await runAlertsPass({
          vaultPath: WORLD_VAULT_PATH,
          date: runDate,
          tickerResults: result.tickerResults,
        });
      } catch (err) {
        console.error("[agent] Alerts pass failed (non-fatal):", err);
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
