import { fetchCompanyProfile } from "../company-profile";
import { getServices, getServicesForUser } from "@/src/registry";
import { debug } from "../debug";
import type { UnifiedAnalysis } from "../../world-brain/brain";
import { analyzeStory, analysisStats, preloadSystemPromptInsights } from "../../world-brain/brain";
import { getRecentVaultStories, runLearningPass } from "../../world-brain/learn";
import {
  resolveEligiblePredictions,
  appendPrediction,
  loadPredictions,
  SUPPORTED_HORIZONS,
} from "../../world-brain/predictions";
import { updateCalibration } from "../../world-brain/calibration";
import { classifyCatalystTypesWithModelFallback as classifyCatalystTypes } from "../../world-brain/catalyst-classifier";
import { computeConfidenceBucket } from "../../types/news.types";
import { fetchFullArticleContent } from "../jina";
import {
  writeStoryNote,
  writeDailySummary,
  writeMacroSnapshot,
  writeEventsSnapshot,
} from "../../world-brain/obsidian";
import { FALLBACK_CONFIDENCE, MAX_ARTICLE_CONTENT_CHARS, SYSTEM_USER_ID } from "../constants";
import { getVaultStore, type VaultStore } from "@/lib/vault/store";
import { getBasicQuote } from "../market-data";
import { getDetailedQuote, type MarketQuote } from "../marketdata/prices";
import { getMacroSnapshot, type MacroSnapshot } from "../marketdata/macro";
import {
  getEventsSnapshot,
  getUpcomingEarnings,
  type EventsSnapshot,
} from "../marketdata/events";
import { runAlertsPass } from "../../world-brain/alerts";
import { appendVaultLog, regenerateVaultIndex } from "../../world-brain/vault-meta";
import type { CompanyProfile, GeoStory, WorldData } from "@/types/geo.types";
import type { ClassifiedStory } from "@/types/news.types";
import type { AgentRunResult, TickerResult } from "./types";
import { fetchUserPositions } from "./utils";
import {
  getCurrentProgress,
  setCurrentProgress,
  getIsCancelled,
  resetCancelled,
} from "./progress";
import { runForecast } from "./forecast";

export async function runStockAgent(userId?: string): Promise<AgentRunResult> {
  if (getCurrentProgress().status === "running") {
    throw new Error("An agent run is already in progress.");
  }

  resetCancelled();
  setCurrentProgress({ status: "running", message: "Fetching live positions..." });
  const startedAt = Date.now();

  // Use per-user services so cache patches land on the same NewsService
  // instance the dashboard reads from. Falling back to the singleton makes
  // the agent's verdicts invisible to the user's `news-<userId>` cache.
  const services = userId ? await getServicesForUser(userId) : getServices();

  try {
    // 1. Fetch live positions
    debug("agent", "Starting Deep Intelligence Sweep...");
    const positions = await fetchUserPositions(userId);
    const holdingTickers = positions.map((p) => p.ticker);
    debug("agent", `Identified ${positions.length} active positions.`);

    // 2. Fetch profiles and sectors
    setCurrentProgress({ ...getCurrentProgress(), message: "Fetching company profiles..." });
    const profiles: Record<string, CompanyProfile> = {};
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

    setCurrentProgress({ ...getCurrentProgress(), message: "Loading macro and event context..." });
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

    // Single vault store for the entire sweep
    const vaultStore = await getVaultStore(userId ?? SYSTEM_USER_ID);
    // Pre-load insights into the system prompt cache
    await preloadSystemPromptInsights(vaultStore);
    if (macroSnapshot) {
      await writeMacroSnapshot(runDate, macroSnapshot, vaultStore);
    }
    if (eventsSnapshot) {
      await writeEventsSnapshot(runDate, eventsSnapshot, vaultStore);
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
      services.newsService.invalidateTicker(p.ticker);
    }

    // 3a. Resolve any pending predictions whose horizon has passed
    const basicQuoteCache: Partial<Record<string, Awaited<ReturnType<typeof getBasicQuote>>>> = {};
    const detailedQuoteCache: Partial<Record<string, Awaited<ReturnType<typeof getDetailedQuote>>>> = {};
    let resolvedCount = 0;
    const userVaultStore: VaultStore = vaultStore;
    if (userVaultStore) {
      setCurrentProgress({ ...getCurrentProgress(), phase: "resolving", message: "Resolving prior predictions..." });
      for (const pos of positions) {
        try {
          const quote = await getBasicQuote(pos.ticker);
          basicQuoteCache[pos.ticker] = quote;
          const resolved = await resolveEligiblePredictions(
            userVaultStore,
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
          await updateCalibration(userVaultStore);
        } catch (err) {
          console.error("[agent] Calibration update failed (non-fatal):", err);
        }
      }
    }

    // 3b. Analyze news per ticker
    for (const pos of positions) {
      if (getIsCancelled()) break;

      setCurrentProgress({
        ...getCurrentProgress(),
        phase: "analyzing",
        ticker: pos.ticker,
        currentHeadline: undefined,
        message: `Fetching news for ${pos.ticker}...`
      });

      // Use the same unified NewsService the dashboard uses — it has the cache and prior verdicts
      const articles = await services.newsService.getNewsForTicker(pos.ticker, profiles[pos.ticker]?.sector);
      // Filter to only articles not yet run through the brain, then cap at 5.
      // Filtering before slicing ensures previously-analyzed articles don't block new ones.
      const top = articles.filter(a => a.isAnalyzed !== true).slice(0, 10);

      // Load per-ticker learned context and few-shot examples from vault
      let tickerContext: string | undefined;
      let recentVerdicts: Array<{ headline: string; verdict: string; confidence: number; reason: string }> | undefined;
      try {
        const raw = await vaultStore.read(`${pos.ticker}.md`);
        if (raw) {
          const body = raw.match(/^---[\s\S]*?---\s*([\s\S]*)$/)?.[1]?.trim() ?? "";
          const prose = body.replace(/^#.*\n/, "").trim();
          if (prose) tickerContext = prose.slice(0, 600);
        }
      } catch { /* stub is empty or missing */ }

      const stories = await getRecentVaultStories(pos.ticker, vaultStore, 3);
      if (stories.length > 0) recentVerdicts = stories;

      if (detailedQuoteCache[pos.ticker] === undefined) {
        try {
          detailedQuoteCache[pos.ticker] = await getDetailedQuote(pos.ticker);
        } catch {
          detailedQuoteCache[pos.ticker] = null;
        }
      }
      const tickerMarketQuote = detailedQuoteCache[pos.ticker];

      const verdicts: TickerResult["verdicts"] = [];

      for (let i = 0; i < top.length; i++) {
        if (getIsCancelled()) break;

        const article = top[i];

        if (!article.headline?.trim() || !article.url?.trim()) {
          console.warn(`[agent] Skipping story with empty headline/URL for ${pos.ticker}`);
          continue;
        }

        setCurrentProgress({
          ...getCurrentProgress(),
          ticker: pos.ticker,
          articleIndex: i + 1,
          totalArticles: top.length,
          currentHeadline: article.headline,
          message: `Analyzing: ${article.headline.slice(0, 40)}...`,
          streamText: "" // Reset stream text for the next story
        });

        // Fetch full article text via Jina — gracefully degrade to summary on failure
        const fullContent = await fetchFullArticleContent(article.url);
        const enrichedSummary = fullContent
          ? `${article.summary ?? ""}\n\n[Full Article]\n${fullContent.slice(0, MAX_ARTICLE_CONTENT_CHARS)}`
          : (article.summary ?? "");

        const analysis = await Promise.race([
          analyzeStory(
            pos.ticker,
            article.headline,
            enrichedSummary,
            holdingTickers,
            holdingSectors,
            (chunk) => {
              const prog = getCurrentProgress();
              setCurrentProgress({ ...prog, streamText: chunk });
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
            },
            vaultStore
          ),
          new Promise<UnifiedAnalysis>((_, reject) =>
            setTimeout(() => reject(new Error("[agent] Story analysis timed out after 120s")), 120_000)
          ),
        ]).catch(() => ({
          verdict: "HOLD" as const,
          confidence: FALLBACK_CONFIDENCE,
          reason: "FALLBACK: Analysis timed out after 120s.",
          sectorTags: [],
          affectedTickers: [],
          originCountryCode: null,
          relevanceScore: 0,
          geoSummary: "",
          analysisFailed: true,
        }));

        const catalystTypes = await classifyCatalystTypes({
          headline: article.headline,
          summary: enrichedSummary,
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

        {
          const profile = profiles[pos.ticker];
          const geoStory: GeoStory = {
            ticker: pos.ticker,
            headline: article.headline,
            summary: enrichedSummary,
            url: article.url,
            datetime: article.datetime,
            verdict: analysis.verdict,
            confidence: analysis.confidence,
            reason: analysis.reason,
            source: article.source,
            originCountryCode: analysis.originCountryCode ?? profile?.countryCode,
            relevanceScore: analysis.relevanceScore,
            isAnalyzed: !analysis.analysisFailed,
            analysisFailed: analysis.analysisFailed,
            classificationSource: analysis.analysisFailed ? undefined : "ai",
            confidenceBucket: computeConfidenceBucket(analysis.confidence, analysis.analysisFailed),
            catalystTypes,
          };
          allGeoStories.push(geoStory);
          await writeStoryNote(geoStory, userVaultStore, profile?.sector, userId ?? SYSTEM_USER_ID);
          // Patch the cached entry in-place so the terminal sees the new verdict
          // immediately without busting the full ticker cache (which causes slow reloads).
          services.newsService.patchCachedStory(pos.ticker, article.url, {
            verdict: analysis.verdict as ClassifiedStory["verdict"],
            confidence: analysis.confidence,
            reason: analysis.reason ?? undefined,
            catalystTypes,
            isAnalyzed: !analysis.analysisFailed,
            analysisFailed: analysis.analysisFailed,
            classificationSource: analysis.analysisFailed ? undefined : "ai",
            confidenceBucket: computeConfidenceBucket(analysis.confidence, analysis.analysisFailed),
            classifiedAt: new Date().toISOString(),
          });
        }
      }

      // Forecast: synthesize this ticker's verdicts into directional predictions
      // at multiple horizons (1d, 7d, 30d). Each horizon is gated independently
      // so a 9am 1d forecast doesn't block the same day's 7d/30d forecasts.
      if (userVaultStore && verdicts.length > 0 && !getIsCancelled()) {
        setCurrentProgress({
          ...getCurrentProgress(),
          phase: "forecasting",
          message: `Forecasting ${pos.ticker}...`,
        });
        try {
          const quote = basicQuoteCache[pos.ticker] ?? (await getBasicQuote(pos.ticker));
          const tickerMarketQuote = detailedQuoteCache[pos.ticker] ?? null;
          const currentPrice = quote?.currentPrice ?? tickerMarketQuote?.price ?? null;
          if (currentPrice !== null) {
            for (const horizon of SUPPORTED_HORIZONS) {
              if (getIsCancelled()) break;
              const horizonCutoff = startedAt - horizon * 86_400_000;
              const existing = await loadPredictions(userVaultStore, pos.ticker, horizon);
              const recentPrediction = existing.find((p) => p.runAt >= horizonCutoff);
              if (recentPrediction) {
                debug(
                  "agent",
                  `Skipping ${horizon}d forecast for ${pos.ticker} — predicted on ${new Date(recentPrediction.runAt).toDateString()}`
                );
                continue;
              }
              const daysUntilEarnings = upcomingEarnings.get(pos.ticker.toUpperCase());
              const prediction = await runForecast(
                pos.ticker,
                currentPrice,
                verdicts,
                tickerContext,
                userVaultStore,
                profiles[pos.ticker]?.sector,
                startedAt,
                macroSnapshot,
                horizon,
                daysUntilEarnings
              );
              if (prediction) {
                await appendPrediction(userVaultStore, prediction);
                debug(
                  "agent",
                  `${horizon}d forecast for ${pos.ticker}: ${prediction.direction} +/-${prediction.magnitudePct}% (conf ${Math.round(prediction.confidence * 100)}%)`
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

    // Log analysis success/failure rate
    const { total, succeeded, failed, retried } = analysisStats;
    debug("agent", `Analysis: ${succeeded}/${total} succeeded, ${failed} failed, ${retried} retried`);

    if (allGeoStories.length > 0 && vaultStore) {
      const today = new Date().toISOString().split("T")[0];
      const dummyWorldData = { profiles, countries: {}, fetchedAt: Date.now() } as unknown as WorldData;
      await writeDailySummary(today, allGeoStories, vaultStore, dummyWorldData);
    }

    const result: AgentRunResult = {
      totalBuys,
      totalSells,
      totalHolds,
      tickerResults,
      startedAt,
      finishedAt: Date.now()
    };

    if (getIsCancelled()) {
      debug("agent", "Sweep cancelled.");
      return result;
    }

    debug("agent", `Sweep complete. ${totalBuys} BUYS, ${totalSells} SELLS, ${totalHolds} HOLDS.`);

    // Learning pass: synthesize session verdicts into per-ticker knowledge files and market-insights.md
    setCurrentProgress({ ...getCurrentProgress(), phase: "learning", message: "Synthesizing session insights into knowledge base..." });
    try {
      await runLearningPass(result, vaultStore, profiles);
    } catch (err) {
      console.error("[agent] Learning pass failed (non-fatal):", err);
    }

    // Alerts pass runs AFTER the learning pass so sector breadth / correlation
    // artifacts are fresh when we compute contradictions, anomalies, and sizing.
    try {
      await runAlertsPass({
        store: vaultStore,
        date: runDate,
        tickerResults: result.tickerResults,
      });
    } catch (err) {
      console.error("[agent] Alerts pass failed (non-fatal):", err);
    }

    try {
      const tickers = result.tickerResults.map((t) => t.ticker).join(", ");
      await appendVaultLog(vaultStore, {
        type: "lint",
        title: `Agent run complete for ${runDate}`,
        details: `Tickers: ${tickers}. ${result.totalBuys} BUY / ${result.totalSells} SELL / ${result.totalHolds} HOLD.`,
      });
      await regenerateVaultIndex(vaultStore);
    } catch (err) {
      console.error("[agent] Index regen failed (non-fatal):", err);
    }

    setCurrentProgress({ status: "complete", results: result });
    return result;
  } catch (err) {
    console.error(`\x1b[1m\x1b[31m[agent] Fatal error:\x1b[0m`, err);
    setCurrentProgress({ status: "error", message: (err as Error).message });
    throw err;
  }
}