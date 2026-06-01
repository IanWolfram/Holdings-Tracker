import { fetchCompanyProfile } from "../company-profile";
import { getServices } from "@/src/registry";
import { debug } from "../debug";
import type { UnifiedAnalysis } from "../../world-brain/brain";
import { analyzeStory } from "../../world-brain/brain";
import { getRecentVaultStories } from "../../world-brain/learn";
import { classifyCatalystTypesWithModelFallback as classifyCatalystTypes } from "../../world-brain/catalyst-classifier";
import { computeConfidenceBucket } from "../../types/news.types";
import { fetchFullArticleContent } from "../jina";
import { writeStoryNote } from "../../world-brain/obsidian";
import { FALLBACK_CONFIDENCE, MAX_ARTICLE_CONTENT_CHARS, SYSTEM_USER_ID } from "../constants";
import { getVaultStore, type VaultStore } from "@/lib/vault/store";
import { getDetailedQuote, type MarketQuote } from "../marketdata/prices";
import { getMacroSnapshot, type MacroSnapshot } from "../marketdata/macro";
import type { GeoStory } from "@/types/geo.types";
import type { ClassifiedStory } from "@/types/news.types";
import type { TickerResult } from "./types";
import { fetchUserPositions } from "./utils";
import { buildMarketContextDigest } from "./market-context";
import { loadSessionInsights } from "../../world-brain/brain";
import {
  getTickerAnalysisProgress,
  getOrInitTickerAnalysis,
  setTickerAnalysis,
  getCurrentProgress,
} from "./progress";

export async function runTickerAnalysis(ticker: string, userId?: string, store?: VaultStore): Promise<TickerResult> {
  const upperTicker = ticker.toUpperCase();
  const uid = userId ?? "__system";

  // Reject if same ticker is already being analyzed for this user
  const existing = getTickerAnalysisProgress(uid, upperTicker);
  if (existing && existing.status === "running") {
    throw new Error(`Already analyzing ${upperTicker}`);
  }

  // Reject if the full sweep is currently on this ticker for this user
  const currentProgress = getCurrentProgress(uid);
  if (currentProgress.status === "running" && currentProgress.ticker === upperTicker) {
    throw new Error(`Full agent sweep is currently analyzing ${upperTicker}`);
  }

  setTickerAnalysis(uid, upperTicker, {
    ticker: upperTicker,
    status: "running",
    articleIndex: 0,
    totalArticles: 0,
    message: `Fetching news for ${upperTicker}...`,
  });

  try {
    // Per-user services so vault writes and cache patches land on the right user.
    // Falls back to the legacy singleton when called without a userId (CLI/cron).
    const services = userId
      ? await (await import("@/src/registry")).getServicesForUser(userId)
      : getServices();

    // Fetch stories via the same NewsService the dashboard uses.
    // No slice — run until every unanalyzed story is processed.
    const articles = await services.newsService.getNewsForTicker(upperTicker);
    const top = articles.filter((a) => a.isAnalyzed !== true);

    setTickerAnalysis(uid, upperTicker, {
      ...getOrInitTickerAnalysis(uid, upperTicker),
      totalArticles: top.length,
      message: top.length === 0 ? "No unanalyzed stories found." : `Analyzing ${top.length} stories...`,
    });

    // Get holding context for cross-portfolio reasoning
    const positions = await fetchUserPositions(userId).catch(() => []);
    const holdingTickers = positions.map((p) => p.ticker);
    const holdingSectorMap: Record<string, string> = {};
    await Promise.all(
      holdingTickers.slice(0, 10).map(async (t) => {
        const prof = await fetchCompanyProfile(t).catch(() => null);
        if (prof?.sector) holdingSectorMap[t.toUpperCase()] = prof.sector;
      })
    );
    const holdingSectors = [...new Set(Object.values(holdingSectorMap))];

    // Load per-ticker vault context
    let tickerContext: string | undefined;
    let recentVerdicts: Array<{ headline: string; verdict: string; confidence: number; reason: string }> | undefined;
    if (store) {
      try {
        const raw = await store.read(`${upperTicker}.md`);
        if (raw) {
          const body = raw.match(/^---[\s\S]*?---\s*([\s\S]*)$/)?.[1]?.trim() ?? "";
          const prose = body.replace(/^#.*\n/, "").trim();
          if (prose) tickerContext = prose.slice(0, 600);
        }
      } catch { /* vault stub missing */ }

      const stories = await getRecentVaultStories(upperTicker, store, 3);
      if (stories.length > 0) recentVerdicts = stories;
    }

    // Fetch macro context
    let macroSnapshot: MacroSnapshot | null = null;
    try { macroSnapshot = await getMacroSnapshot(); } catch { macroSnapshot = null; }

    // Portfolio-wide market & sector context digest (peers, sector ETFs, broad market).
    let marketDigest: string | undefined;
    try {
      const digest = await buildMarketContextDigest(holdingTickers, holdingSectorMap, macroSnapshot);
      marketDigest = digest?.text;
    } catch (err) {
      console.error("[agent] Market context digest failed (non-fatal):", err);
    }

    // This user's recent session insights (threaded per call, never cached globally).
    const sessionInsights = store ? await loadSessionInsights(store) : "";

    // Fetch ticker market quote for tickerState context
    let tickerQuote: Awaited<ReturnType<typeof getDetailedQuote>> | null = null;
    try { tickerQuote = await getDetailedQuote(upperTicker); } catch { tickerQuote = null; }

    const verdicts: TickerResult["verdicts"] = [];

    for (let i = 0; i < top.length; i++) {
      const article = top[i];

      if (!article.headline?.trim() || !article.url?.trim()) {
        console.warn(`[agent] Skipping story with empty headline/URL for ${upperTicker}`);
        continue;
      }

      setTickerAnalysis(uid, upperTicker, {
        ...getOrInitTickerAnalysis(uid, upperTicker),
        articleIndex: i + 1,
        currentHeadline: article.headline,
        message: `Analyzing: ${article.headline.slice(0, 40)}...`,
      });

      // Fetch full article text via Jina — gracefully degrade to summary on failure
      const fullContent = await fetchFullArticleContent(article.url);
      const enrichedSummary = fullContent
        ? `${article.summary ?? ""}\n\n[Full Article]\n${fullContent.slice(0, MAX_ARTICLE_CONTENT_CHARS)}`
        : (article.summary ?? "");

      const analysis = await Promise.race([
        analyzeStory(
          upperTicker,
          article.headline,
          enrichedSummary,
          holdingTickers,
          holdingSectors,
          undefined, // no streaming for per-ticker runs
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
            tickerState: tickerQuote
              ? {
                  price: tickerQuote.price,
                  change1d: tickerQuote.change1d,
                  change5d: tickerQuote.change5d,
                  change30d: tickerQuote.change30d,
                  return52wHigh: tickerQuote.return52wHigh,
                  rsi14: tickerQuote.rsi14,
                  atr14: tickerQuote.atr14,
                }
              : undefined,
          },
          store,
          holdingSectorMap,
          marketDigest,
          sessionInsights
        ),
        new Promise<UnifiedAnalysis>((_, reject) =>
          setTimeout(() => reject(new Error("[agent] Per-ticker analysis timed out after 120s")), 120_000)
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
        analysis,
      });

      // Patch cache and write to vault
      const profile = await fetchCompanyProfile(upperTicker).catch(() => null);
      const geoStory: GeoStory = {
        ticker: upperTicker,
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
      const vaultStore: VaultStore = userId
        ? await getVaultStore(userId)
        : store ?? await getVaultStore(SYSTEM_USER_ID);
      await writeStoryNote(geoStory, vaultStore, profile?.sector, userId ?? SYSTEM_USER_ID);

      services.newsService.patchCachedStory(upperTicker, article.url, {
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

    const result: TickerResult = { ticker: upperTicker, verdicts };
    setTickerAnalysis(uid, upperTicker, {
      ...getOrInitTickerAnalysis(uid, upperTicker),
      status: "complete",
      results: result,
      message: "Analysis complete.",
    });

    debug("agent", `Per-ticker analysis complete for ${upperTicker}: ${verdicts.length} stories analyzed.`);
    return result;
  } catch (err) {
    console.error(`\x1b[31m[agent] Per-ticker analysis failed for ${upperTicker}:\x1b[0m`, err);
    setTickerAnalysis(uid, upperTicker, {
      ...getOrInitTickerAnalysis(uid, upperTicker),
      status: "error",
      message: (err as Error).message,
    });
    throw err;
  }
}