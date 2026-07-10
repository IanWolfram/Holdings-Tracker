import fs from "fs";
import path from "path";

import { callLlm } from "../../world-brain/brain";
import { classifyCatalystTypesWithModelFallback as classifyCatalystTypes } from "../../world-brain/catalyst-classifier";
import { getRecentResolvedPredictions } from "../../world-brain/predictions";
import {
  loadCalibrationReport,
  getConfidenceReliabilityFactor,
  buildCatalystCalibrationBlock,
} from "../../world-brain/calibration";
import { FALLBACK_CONFIDENCE } from "../constants";
import { getActiveModel } from "../ai-config";
import type { MacroSnapshot } from "../marketdata/macro";
import type { MarketQuote } from "../marketdata/prices";
import type { CongressTrade } from "@/types/news.types";
import type { VaultStore } from "@/lib/vault/store";
import type { TickerPrediction, PredictionDirection } from "@/types/predictions";
import type { TickerResult } from "./types";
import { summarizeMacroForPrompt, uniqueCatalystTypes } from "./utils";

/** Congress filings arrive 30–45 days after the trade (STOCK Act), so anything
 *  filed within this window is still recent positioning context. */
const CONGRESS_RECENT_FILING_DAYS = 120;

/**
 * v4+ prompt input: congressional trading in this ticker. Kept deliberately
 * framed as SLOW positioning context — the filing lag means it must never read
 * as a fresh catalyst.
 */
function buildCongressBlock(ticker: string, trades: CongressTrade[], nowMs: number): string {
  const cutoff = nowMs / 1000 - CONGRESS_RECENT_FILING_DAYS * 86_400;
  const recent = trades
    .filter((t) => t.ticker === ticker && t.filedDate >= cutoff)
    .sort((a, b) => b.filedDate - a.filedDate);
  if (recent.length === 0) return "";

  const buys = recent.filter((t) => t.tradeType === "buy" || t.tradeType === "buy_option").length;
  const sells = recent.length - buys;
  const day = (s: number) => new Date(s * 1000).toISOString().slice(0, 10);
  const lines = recent.slice(0, 5).map((t) => {
    const side = t.tradeType.startsWith("buy") ? "BUY" : "SELL";
    const asset = t.assetType && t.assetType !== "stock" ? ` (${t.assetType})` : "";
    const lagDays = Math.max(0, Math.round((t.filedDate - t.tradeDate) / 86_400));
    return `- ${t.politician} (${t.party}-${t.chamber}) ${side} ${t.amount}${asset}, traded ${day(t.tradeDate)}, filed ${day(t.filedDate)} (${lagDays}d lag)`;
  });

  return (
    `\n\nCongressional trades in ${ticker} (filings from the last ${CONGRESS_RECENT_FILING_DAYS} days): ${buys} buy(s), ${sells} sell(s).\n` +
    lines.join("\n") +
    `\nCaution: STOCK Act disclosures lag the trade by 30–45 days — treat this as slow positioning context, NOT a fresh catalyst. A lone small trade is weak evidence; a same-direction cluster from multiple politicians is more meaningful.`
  );
}

export async function runForecast(
  ticker: string,
  currentPrice: number,
  verdicts: TickerResult["verdicts"],
  tickerContext: string | undefined,
  store: VaultStore,
  sector: string | undefined,
  runAt: number,
  macroSnapshot: MacroSnapshot | null,
  horizonDays: number,
  daysUntilEarnings?: number | null,
  options?: {
    version?: string;
    shadow?: boolean;
    marketQuote?: MarketQuote | null;
    /** Recent congressional trades in this ticker (v4+ input). */
    congressTrades?: CongressTrade[] | null;
  }
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

  const catalystsRaw = await Promise.all(verdicts.slice(0, 5).map(async (v) => ({
    headline: v.headline.slice(0, 100),
    verdict: v.verdict,
    confidence: v.analysis.confidence,
    catalystTypes: await classifyCatalystTypes({
      headline: v.headline,
      reason: v.analysis.reason,
      verdict: v.verdict,
    }),
  })));
  const predictionCatalystTypes = uniqueCatalystTypes(
    catalystsRaw.flatMap((catalyst) => catalyst.catalystTypes ?? [])
  );

  // Self-calibration block uses outcomes from the same horizon — a 30-day
  // forecaster should learn from prior 30-day outcomes, not 7-day ones.
  const recentResolved = await getRecentResolvedPredictions(store, ticker, 3, horizonDays);

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
            // Show the STATED confidence so the model calibrates against what it
            // said, not the shrink applied afterwards.
            return `${i + 1}. [${new Date(p.runAt).toISOString().slice(0, 10)}] Predicted ${p.direction} +/-${p.magnitudePct}% (conf ${Math.round((p.rawConfidence ?? p.confidence) * 100)}%) → ${p.outcome} (actual ${sign}${p.actualPct?.toFixed(1) ?? "?"}%)`;
          })
          .join("\n")
      : "";

  const earningsHint =
    typeof daysUntilEarnings === "number" && daysUntilEarnings >= 0 && daysUntilEarnings <= 7
      ? `\nEarnings in ${daysUntilEarnings} day${daysUntilEarnings === 1 ? "" : "s"} — widen magnitude bands and treat this window as higher-variance. Bias confidence down unless catalysts are unambiguous.`
      : "";

  // Volatility block — part of the promoted v3 production recipe (and any future
  // shadow candidate). Gives the forecaster the ticker's OWN realized volatility
  // (ATR%·√horizon noise band) instead of the generic large-cap/small-cap
  // magnitude table in FORECASTER.md, so magnitude and the FLAT threshold are
  // sized to the actual stock. A future candidate that drops it would set its own
  // version label here.
  const mq = options?.marketQuote;
  const atrPct =
    mq && typeof mq.atr14 === "number" && mq.atr14 > 0 && mq.price > 0
      ? (mq.atr14 / mq.price) * 100
      : null;
  const fmtPct = (v: number | null | undefined) =>
    typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "n/a";
  const wantsVolatility = ["v2", "v3", "v4"].includes(options?.version ?? "");
  const volatilityBlock =
    wantsVolatility && atrPct !== null
      ? `\n\nRealized volatility for ${ticker} — size your magnitude band and FLAT threshold to THIS stock, not the generic table:\n` +
        `- ATR(14): ${atrPct.toFixed(2)}% of price per day (a normal daily range).\n` +
        `- Recent moves: 1d ${fmtPct(mq?.change1d)}, 5d ${fmtPct(mq?.change5d)}, 30d ${fmtPct(mq?.change30d)}.\n` +
        `- Expected horizon noise ≈ ATR%·√${horizonDays} ≈ ${(atrPct * Math.sqrt(horizonDays)).toFixed(1)}%. A move within that band is NOISE: forecast FLAT unless you expect a move clearly beyond it. Set magnitudePct relative to this, not a fixed table.`
      : "";

  // v3 directional policy — PROMOTED TO PRODUCTION 2026-06-25 (production now runs
  // version "v3"). The fix for the diagnosed failure mode: the old cluster-gated
  // forecaster predicted FLAT ~73% of the time and DOWN ~never, because its UP/DOWN
  // gate required a 2+ same-direction NEWS cluster and the news feed is ~6:1 bullish
  // (18 of 20 realized-down moves arrived with zero bearish headlines). This block
  // frees the forecaster to commit to a direction (incl. DOWN) from price/macro
  // alone and to stop defaulting to FLAT. NOTE: a momentum backtest (n=10) found
  // realized-DOWN moves were mostly reversals (post-uptrend), not downtrends — so
  // this deliberately does NOT hardcode trend-following; it lets the model weigh
  // continuation vs reversal. Validated via the shadow A/B before promotion: 88.9%
  // directional precision (n=18, Wilson-95 lower bound 67% > 50%), edge +3.48%/call.
  // See scripts/compare-forecaster-versions.ts + scripts/diagnose-forecaster.ts.
  const directionalPolicyBlock =
    options?.version === "v3" || options?.version === "v4"
      ? `\n\nDIRECTIONAL POLICY (overrides any "FLAT by default / require a news cluster" guidance above):\n` +
        `- Most real moves arrive with NO confirming news. Sparse, mixed, or absent news is the common case — not a reason to forecast FLAT.\n` +
        `- You may commit to a direction from price action, technicals, or macro ALONE — a directional call does NOT require a supporting news cluster.\n` +
        `- Forecast DOWN as readily as UP. Downside is ~half of all moves; do NOT require bearish headlines to call DOWN. Weigh both regimes from the recent price path above: a steady advance can persist (UP), while a sharp, stretched run-up is also a pullback/reversal risk (DOWN). Decide which the move size and recent path imply.\n` +
        `- Reserve FLAT for when no input — news, price, or macro — points anywhere AND the expected move is inside the noise band. FLAT should be a minority of your calls, not a fallback.\n` +
        `- Ground confidence in evidence strength: one weak signal is ~0.55–0.65, not 0.80. Reserve 0.80+ for multiple aligned signals.`
      : "";

  // v4 inputs: congressional positioning + the forecaster's own per-catalyst
  // track record. Both were previously invisible to the forecaster — congress
  // trades only ever surfaced on the Hot page, which is how the UI could show a
  // congressman buying while the forecast called DOWN with no acknowledgment.
  const isV4Plus = options?.version === "v4";
  const congressBlock =
    isV4Plus && options?.congressTrades?.length
      ? buildCongressBlock(ticker, options.congressTrades, runAt)
      : "";
  const catalystCalibrationBlock = isV4Plus ? await buildCatalystCalibrationBlock(store) : "";

  const userMessage =
    `Ticker: ${ticker}\nCurrent price: $${currentPrice.toFixed(2)}\n` +
    `Target horizon: ${horizonDays} day${horizonDays === 1 ? "" : "s"}\n` +
    (sector ? `Sector: ${sector}\n` : "") +
    summarizeMacroForPrompt(macroSnapshot) +
    earningsHint +
    volatilityBlock +
    directionalPolicyBlock +
    congressBlock +
    `\nSession verdicts:\n${verdictsBlock}` +
    (tickerContext ? `\n\nTicker Knowledge:\n${tickerContext.slice(0, 400)}` : "") +
    calibrationBlock +
    catalystCalibrationBlock +
    `\n\nForecast for the ${horizonDays}-day horizon. OUTPUT ONLY THE JSON OBJECT. NO MARKDOWN. START WITH { END WITH }.`;

  const raw = await callLlm(forecasterPrompt, userMessage);
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
    const version = options?.version;
    const shadow = options?.shadow === true;

    // Ground the displayed conviction in observed reliability. The raw model
    // confidence is systematically inflated (historically ~0.77 stated vs ~0.42
    // realized win rate), so we deterministically shrink overconfident buckets
    // toward their measured directional win rate — the same correction already
    // applied to news-card verdicts in brain.ts, now applied to the forecast
    // confidence that actually reaches the UI. Shrink-only: a bucket meeting or
    // beating its stated confidence is left untouched.
    const rawConfidence =
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : FALLBACK_CONFIDENCE;
    const reliabilityFactor = getConfidenceReliabilityFactor(
      await loadCalibrationReport(store),
      rawConfidence
    );
    const calibratedConfidence = Math.max(0, Math.min(1, rawConfidence * reliabilityFactor));
    // Keep v1 and shadow (v2) predictions distinct: they share ticker/horizon/runAt
    // and may share an engine model, so the id must encode the version or the two
    // would collide in the per-ticker predictions file and in calibration.
    const idSuffix = shadow ? "-shadow" : version ? `-${version}` : "";
    return {
      id: `${ticker}-${horizonDays}d-${runAt}${idSuffix}`,
      ticker,
      runAt,
      priceAtPrediction: currentPrice,
      direction: parsed.direction as PredictionDirection,
      magnitudePct:
        typeof parsed.magnitudePct === "number"
          ? Math.max(0, Math.min(30, parsed.magnitudePct))
          : 0,
      horizonDays,
      confidence: calibratedConfidence,
      rawConfidence,
      reasoning: parsed.reasoning ?? "",
      catalysts: catalystsRaw,
      catalystTypes:
        predictionCatalystTypes.length > 0 ? predictionCatalystTypes : ["other"],
      engine: active.model,
      ...(version ? { version } : {}),
      ...(shadow ? { shadow: true } : {}),
      status: "pending",
    };
  } catch {
    console.warn(`[agent] FORECASTER parse failed for ${ticker} @ ${horizonDays}d`);
    return null;
  }
}