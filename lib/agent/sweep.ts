import { fetchCompanyProfile } from "../company-profile";
import { getServices, getServicesForUser } from "@/src/registry";
import { debug } from "../debug";
import type { UnifiedAnalysis } from "../../world-brain/brain";
import { analyzeStory, analysisStats, loadSessionInsights } from "../../world-brain/brain";
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
import { getDetailedQuote, getDailyBars } from "../marketdata/prices";
import { getMacroSnapshot, type MacroSnapshot } from "../marketdata/macro";
import {
  getEventsSnapshot,
  getUpcomingEarnings,
  type EventsSnapshot,
} from "../marketdata/events";
import { runAlertsPass } from "../../world-brain/alerts";
import { appendVaultLog, regenerateVaultIndex } from "../../world-brain/vault-meta";
import type { CompanyProfile, GeoStory, WorldData } from "@/types/geo.types";
import { type ClassifiedStory, type CongressTrade, VERDICT_LABEL } from "@/types/news.types";
import { fetchCongressTrades } from "@/lib/congress";
import type { AgentRunResult, TickerResult } from "./types";
import { fetchUserPositions } from "./utils";
import { SWEEP_MAX_TICKERS } from "@/lib/rate-limit";
import {
  getCurrentProgress,
  setCurrentProgress,
  getIsCancelled,
  getRunGeneration,
} from "./progress";
import { runForecast } from "./forecast";
import { buildMarketContextDigest } from "./market-context";
import { emitSignals, qualifiesAsSignal, type SignalCandidate } from "./signals";

// How many positions analyze concurrently inside a sweep. callLlm retries 429s
// but has no queue of its own, so this caps peak DeepSeek load to ~this many
// simultaneous analyses (each ticker still processes its own articles serially).
const SWEEP_ANALYSIS_CONCURRENCY = 5;

export async function runStockAgent(userId?: string): Promise<AgentRunResult> {
  const uid = userId ?? "__system";
  if (getCurrentProgress(uid).status === "running") {
    throw new Error("An agent run is already in progress.");
  }

  // Capture this run's generation; cancelling bumps it, marking us stale.
  const runGen = getRunGeneration(uid);
  setCurrentProgress(uid, { status: "running", message: "Fetching live positions..." });
  const startedAt = Date.now();

  // Use per-user services so cache patches land on the same NewsService
  // instance the dashboard reads from. Falling back to the singleton makes
  // the agent's verdicts invisible to the user's `news-<userId>` cache.
  const services = userId ? await getServicesForUser(userId) : getServices();

  try {
    // 1. Fetch live positions
    debug("agent", "Starting Deep Intelligence Sweep...");
    const allPositions = await fetchUserPositions(userId);
    // Cap tickers per sweep — each ticker drives news + a DeepSeek forecast per
    // horizon, so this bounds spend for an account with a huge holding list.
    const positions =
      allPositions.length > SWEEP_MAX_TICKERS ? allPositions.slice(0, SWEEP_MAX_TICKERS) : allPositions;
    if (allPositions.length > SWEEP_MAX_TICKERS) {
      debug("agent", `Capping sweep at ${SWEEP_MAX_TICKERS}/${allPositions.length} tickers.`);
    }
    const holdingTickers = positions.map((p) => p.ticker);
    debug("agent", `Identified ${positions.length} active positions.`);

    // 2. Fetch profiles and sectors
    setCurrentProgress(uid, { ...getCurrentProgress(uid), message: "Fetching company profiles..." });
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

    // Ticker → sector map so the brain can reason about cross-holding impact
    // grounded in each holding's actual sector (not a hardcoded list).
    const holdingSectorMap: Record<string, string> = {};
    for (const [t, prof] of Object.entries(profiles)) {
      if (prof?.sector) holdingSectorMap[t.toUpperCase()] = prof.sector;
    }

    let macroSnapshot: MacroSnapshot | null = null;
    let eventsSnapshot: EventsSnapshot | null = null;
    const runDate = new Date(startedAt).toISOString().split("T")[0];

    setCurrentProgress(uid, { ...getCurrentProgress(uid), message: "Loading macro and event context..." });
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
    // Load this user's recent session insights once; threaded into each analyzeStory
    // call (not cached globally) so a multi-tenant process can't leak across users.
    const sessionInsights = await loadSessionInsights(vaultStore);
    if (macroSnapshot) {
      await writeMacroSnapshot(runDate, macroSnapshot, vaultStore);
    }
    if (eventsSnapshot) {
      await writeEventsSnapshot(runDate, eventsSnapshot, vaultStore);
    }

    // Build a portfolio-wide market & sector context digest ONCE per sweep from
    // sources outside the user's holdings (peers, sector ETFs, broad market news).
    // Injected into every analyzeStory call so the brain has sector awareness.
    let marketDigest: string | undefined;
    setCurrentProgress(uid, { ...getCurrentProgress(uid), message: "Building market & sector context..." });
    try {
      const digest = await buildMarketContextDigest(holdingTickers, holdingSectorMap, macroSnapshot);
      marketDigest = digest?.text;
    } catch (err) {
      console.error("[agent] Market context digest failed (non-fatal):", err);
    }

    // Pre-earnings boost: fetch a single 14-day earnings window so each ticker
    // forecast can flag "earnings imminent" without re-querying Finnhub per call.
    let upcomingEarnings = new Map<string, number>();
    try {
      upcomingEarnings = await getUpcomingEarnings(holdingTickers, new Date(startedAt), 14);
    } catch {
      upcomingEarnings = new Map();
    }

    // Congressional trades across all holdings, fetched ONCE per sweep and
    // grouped by ticker — a v4 forecaster input. Previously this data only
    // surfaced on the Hot page, fully disconnected from the forecast.
    const congressByTicker = new Map<string, CongressTrade[]>();
    try {
      const trades = await fetchCongressTrades(holdingTickers);
      for (const trade of trades) {
        const bucket = congressByTicker.get(trade.ticker) ?? [];
        bucket.push(trade);
        congressByTicker.set(trade.ticker, bucket);
      }
    } catch (err) {
      console.error("[agent] Congress trade fetch failed (non-fatal):", err);
    }

    const tickerResults: TickerResult[] = [];
    const allGeoStories: GeoStory[] = [];
    const signalCandidates: SignalCandidate[] = [];
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
      setCurrentProgress(uid, { ...getCurrentProgress(uid), phase: "resolving", message: "Resolving prior predictions..." });
      for (const pos of positions) {
        try {
          const quote = await getBasicQuote(pos.ticker);
          basicQuoteCache[pos.ticker] = quote;
          // Daily bars let the resolver score against the close at the horizon
          // date and size the FLAT band to the ticker's own volatility.
          const bars = await getDailyBars(pos.ticker).catch(() => []);
          const resolved = await resolveEligiblePredictions(
            userVaultStore,
            pos.ticker,
            quote?.currentPrice ?? null,
            startedAt,
            undefined,
            bars
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

    // 3b. Analyze news per ticker — positions run concurrently through a bounded
    // pool instead of a serial loop, so an N-ticker portfolio no longer chains
    // (news fetch + DeepSeek analysis + multi-horizon forecast) end-to-end. Each
    // position is a self-contained unit returning its own partial result, so
    // concurrent tickers never race on the shared accumulators below.
    setCurrentProgress(uid, {
      ...getCurrentProgress(uid),
      phase: "analyzing",
      ticker: undefined,
      currentHeadline: undefined,
      streamText: "",
      articleIndex: 0,
      totalArticles: positions.length,
      message: `Analyzing ${positions.length} positions in parallel...`,
    });

    let tickersCompleted = 0;

    const analyzePosition = async (
      pos: (typeof positions)[number]
    ): Promise<{
      result: TickerResult;
      geoStories: GeoStory[];
      buys: number;
      sells: number;
      holds: number;
      signals: SignalCandidate[];
    }> => {
      const localGeo: GeoStory[] = [];
      const localSignals: SignalCandidate[] = [];
      let buys = 0;
      let sells = 0;
      let holds = 0;
      const verdicts: TickerResult["verdicts"] = [];

      if (getIsCancelled(uid, runGen)) {
        return { result: { ticker: pos.ticker, verdicts }, geoStories: localGeo, buys, sells, holds, signals: localSignals };
      }

      // Use the same unified NewsService the dashboard uses — it has the cache and prior verdicts
      const articles = await services.newsService.getNewsForTicker(pos.ticker, profiles[pos.ticker]?.sector);
      // Analyze the FULL backlog of stories not yet run through the brain — a
      // sweep only finishes a ticker when nothing unanalyzed remains.
      const unanalyzed = articles.filter((a) => a.isAnalyzed !== true);

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

      const recentStories = await getRecentVaultStories(pos.ticker, vaultStore, 3);
      if (recentStories.length > 0) recentVerdicts = recentStories;

      if (detailedQuoteCache[pos.ticker] === undefined) {
        try {
          detailedQuoteCache[pos.ticker] = await getDetailedQuote(pos.ticker);
        } catch {
          detailedQuoteCache[pos.ticker] = null;
        }
      }
      const tickerMarketQuote = detailedQuoteCache[pos.ticker];

      // Work through every unanalyzed story until the queue is empty. A story
      // whose analysis fails (timeout / API error) goes back to the end of the
      // queue for another try; only a story that exhausts its attempts records
      // the FALLBACK verdict, so a flaky call can't leave the backlog
      // partially analyzed.
      const MAX_STORY_ATTEMPTS = 3;
      const queue = unanalyzed.map((article) => ({ article, attempts: 0 }));
      while (queue.length > 0) {
        if (getIsCancelled(uid, runGen)) break;

        const item = queue.shift()!;
        const article = item.article;
        item.attempts++;

        if (!article.headline?.trim() || !article.url?.trim()) {
          console.warn(`[agent] Skipping story with empty headline/URL for ${pos.ticker}`);
          continue;
        }

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
            undefined, // no token streaming — parallel tickers would interleave one shared stream
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
            vaultStore,
            holdingSectorMap,
            marketDigest,
            sessionInsights
          ),
          new Promise<UnifiedAnalysis>((_, reject) =>
            setTimeout(() => reject(new Error("[agent] Story analysis timed out after 120s")), 120_000)
          ),
        ]).catch(() => ({
          verdict: "HOLD" as const,
          confidence: FALLBACK_CONFIDENCE,
          summary: "",
          reason: "FALLBACK: Analysis timed out after 120s.",
          sectorTags: [],
          affectedTickers: [],
          originCountryCode: null,
          relevanceScore: 0,
          geoSummary: "",
          analysisFailed: true,
        }));

        if (analysis.analysisFailed && item.attempts < MAX_STORY_ATTEMPTS) {
          // Transient failure — requeue for another attempt instead of
          // recording a FALLBACK verdict; the story stays unanalyzed until it
          // either succeeds or exhausts its attempts.
          queue.push(item);
          continue;
        }

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

        if (analysis.verdict === "BUY") buys++;
        else if (analysis.verdict === "SELL") sells++;
        else holds++;

        {
          const profile = profiles[pos.ticker];
          const geoStory: GeoStory = {
            ticker: pos.ticker,
            headline: article.headline,
            // Prefer the DeepSeek-generated neutral recap; fall back to the raw
            // provider summary. NEVER store `enrichedSummary` here — it carries the
            // full Jina-scraped article body and would dump up to ~12k chars into
            // the note's Summary block.
            summary: analysis.summary || article.summary || "",
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
          localGeo.push(geoStory);
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
      if (userVaultStore && verdicts.length > 0 && !getIsCancelled(uid, runGen)) {
        try {
          const quote = basicQuoteCache[pos.ticker] ?? (await getBasicQuote(pos.ticker));
          const forecastMarketQuote = detailedQuoteCache[pos.ticker] ?? null;
          const currentPrice = quote?.currentPrice ?? forecastMarketQuote?.price ?? null;
          if (currentPrice !== null) {
            for (const horizon of SUPPORTED_HORIZONS) {
              if (getIsCancelled(uid, runGen)) break;
              const horizonCutoff = startedAt - horizon * 86_400_000;
              const existing = await loadPredictions(userVaultStore, pos.ticker, horizon);
              // Skip-check only considers production (non-shadow) v1 predictions —
              // we want a v1 to run if only a v2 shadow exists from a prior sweep.
              const recentPrediction = existing.find(
                (p) => p.runAt >= horizonCutoff && p.shadow !== true
              );
              if (recentPrediction) {
                debug(
                  "agent",
                  `Skipping ${horizon}d forecast for ${pos.ticker} — predicted on ${new Date(recentPrediction.runAt).toDateString()}`
                );
                continue;
              }
              const daysUntilEarnings = upcomingEarnings.get(pos.ticker.toUpperCase());
              // PRODUCTION runs the v4 recipe (shipped 2026-07-09, direct to
              // production by owner decision — no shadow A/B): the v3 recipe
              // (vol-aware sizing + directional policy, promoted 2026-06-25 at
              // 88.9% directional precision n=18) PLUS congressional-trade
              // positioning and the forecaster's own per-catalyst track record.
              // Evaluate v4 vs v3 retrospectively from resolved outcomes via
              // scripts/compare-forecaster-versions.ts.
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
                daysUntilEarnings,
                {
                  version: "v4",
                  marketQuote: forecastMarketQuote,
                  congressTrades: congressByTicker.get(pos.ticker) ?? null,
                }
              );
              if (prediction) {
                await appendPrediction(userVaultStore, prediction);
                debug(
                  "agent",
                  `${horizon}d forecast for ${pos.ticker}: ${prediction.direction} +/-${prediction.magnitudePct}% (conf ${Math.round(prediction.confidence * 100)}%)`
                );
                if (qualifiesAsSignal(prediction)) {
                  localSignals.push({
                    ticker: pos.ticker,
                    direction: prediction.direction as "UP" | "DOWN",
                    magnitudePct: prediction.magnitudePct,
                    confidence: prediction.confidence,
                    rawConfidence: prediction.rawConfidence,
                    horizonDays: prediction.horizonDays,
                    reasoning: prediction.reasoning,
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error(`[agent] Forecast failed for ${pos.ticker} (non-fatal):`, err);
        }
      }

      return { result: { ticker: pos.ticker, verdicts }, geoStories: localGeo, buys, sells, holds, signals: localSignals };
    };

    // Bounded concurrency pool — workers pull from a shared cursor so at most
    // SWEEP_ANALYSIS_CONCURRENCY positions are analyzed at once. Each result is
    // merged into the shared accumulators on the single event-loop turn the
    // worker resumes, so no locking is needed.
    {
      let cursor = 0;
      const worker = async () => {
        while (cursor < positions.length) {
          if (getIsCancelled(uid, runGen)) break;
          const pos = positions[cursor++];
          const part = await analyzePosition(pos);
          tickerResults.push(part.result);
          allGeoStories.push(...part.geoStories);
          totalBuys += part.buys;
          totalSells += part.sells;
          totalHolds += part.holds;
          signalCandidates.push(...part.signals);
          tickersCompleted++;
          setCurrentProgress(uid, {
            ...getCurrentProgress(uid),
            phase: "analyzing",
            articleIndex: tickersCompleted,
            totalArticles: positions.length,
            message: `Analyzed ${tickersCompleted}/${positions.length} positions...`,
          });
        }
      };
      const poolSize = Math.min(SWEEP_ANALYSIS_CONCURRENCY, positions.length);
      await Promise.all(Array.from({ length: poolSize }, () => worker()));
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

    if (getIsCancelled(uid, runGen)) {
      debug("agent", "Sweep cancelled.");
      return result;
    }

    debug("agent", `Sweep complete. ${totalBuys} BUYS, ${totalSells} SELLS, ${totalHolds} HOLDS.`);

    // Learning pass: synthesize session verdicts into per-ticker knowledge files and market-insights.md
    setCurrentProgress(uid, { ...getCurrentProgress(uid), phase: "learning", message: "Synthesizing session insights into knowledge base..." });
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

    // Surface strong directional forecasts to the user as notifications + chat
    // messages. Per-user only (skips system runs); dedup keeps manual + scheduled
    // sweeps from double-notifying.
    try {
      await emitSignals(userId, signalCandidates, userVaultStore);
    } catch (err) {
      console.error("[agent] Signal emission failed (non-fatal):", err);
    }

    try {
      const tickers = result.tickerResults.map((t) => t.ticker).join(", ");
      await appendVaultLog(vaultStore, {
        type: "lint",
        title: `Agent run complete for ${runDate}`,
        details: `Tickers: ${tickers}. ${result.totalBuys} ${VERDICT_LABEL.BUY} / ${result.totalHolds} ${VERDICT_LABEL.HOLD} / ${result.totalSells} ${VERDICT_LABEL.SELL}.`,
      });
      await regenerateVaultIndex(vaultStore);
    } catch (err) {
      console.error("[agent] Index regen failed (non-fatal):", err);
    }

    // Only write terminal status if this run is still the current generation —
    // a cancelled run must not clobber the progress of a newer run.
    if (!getIsCancelled(uid, runGen)) {
      setCurrentProgress(uid, { status: "complete", results: result });
    }
    return result;
  } catch (err) {
    console.error(`\x1b[1m\x1b[31m[agent] Fatal error:\x1b[0m`, err);
    if (!getIsCancelled(uid, runGen)) {
      setCurrentProgress(uid, { status: "error", message: (err as Error).message });
    }
    throw err;
  }
}