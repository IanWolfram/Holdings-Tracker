import fs from "fs";
import path from "path";

import { callLlm } from "../../world-brain/brain";
import { classifyCatalystTypesWithModelFallback as classifyCatalystTypes } from "../../world-brain/catalyst-classifier";
import { getRecentResolvedPredictions } from "../../world-brain/predictions";
import { FALLBACK_CONFIDENCE } from "../constants";
import { getActiveModel } from "../ai-config";
import type { MacroSnapshot } from "../marketdata/macro";
import type { MarketQuote } from "../marketdata/prices";
import type { VaultStore } from "@/lib/vault/store";
import type { CatalystType, TickerPrediction, PredictionDirection } from "@/types/predictions";
import type { TickerResult } from "./types";
import { summarizeMacroForPrompt, uniqueCatalystTypes } from "./utils";

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
  options?: { version?: string; shadow?: boolean; marketQuote?: MarketQuote | null }
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
            return `${i + 1}. [${new Date(p.runAt).toISOString().slice(0, 10)}] Predicted ${p.direction} +/-${p.magnitudePct}% (conf ${Math.round(p.confidence * 100)}%) → ${p.outcome} (actual ${sign}${p.actualPct?.toFixed(1) ?? "?"}%)`;
          })
          .join("\n")
      : "";

  const earningsHint =
    typeof daysUntilEarnings === "number" && daysUntilEarnings >= 0 && daysUntilEarnings <= 7
      ? `\nEarnings in ${daysUntilEarnings} day${daysUntilEarnings === 1 ? "" : "s"} — widen magnitude bands and treat this window as higher-variance. Bias confidence down unless catalysts are unambiguous.`
      : "";

  // Volatility block — only fed to v2, so the v1-vs-v2 shadow A/B isolates the
  // effect of giving the forecaster the ticker's OWN realized volatility instead
  // of the generic large-cap/small-cap magnitude table in FORECASTER.md.
  const mq = options?.marketQuote;
  const atrPct =
    mq && typeof mq.atr14 === "number" && mq.atr14 > 0 && mq.price > 0
      ? (mq.atr14 / mq.price) * 100
      : null;
  const fmtPct = (v: number | null | undefined) =>
    typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "n/a";
  const volatilityBlock =
    options?.version === "v2" && atrPct !== null
      ? `\n\nRealized volatility for ${ticker} — size your magnitude band and FLAT threshold to THIS stock, not the generic table:\n` +
        `- ATR(14): ${atrPct.toFixed(2)}% of price per day (a normal daily range).\n` +
        `- Recent moves: 1d ${fmtPct(mq?.change1d)}, 5d ${fmtPct(mq?.change5d)}, 30d ${fmtPct(mq?.change30d)}.\n` +
        `- Expected horizon noise ≈ ATR%·√${horizonDays} ≈ ${(atrPct * Math.sqrt(horizonDays)).toFixed(1)}%. A move within that band is NOISE: forecast FLAT unless you expect a move clearly beyond it. Set magnitudePct relative to this, not a fixed table.`
      : "";

  const userMessage =
    `Ticker: ${ticker}\nCurrent price: $${currentPrice.toFixed(2)}\n` +
    `Target horizon: ${horizonDays} day${horizonDays === 1 ? "" : "s"}\n` +
    (sector ? `Sector: ${sector}\n` : "") +
    summarizeMacroForPrompt(macroSnapshot) +
    earningsHint +
    volatilityBlock +
    `\nSession verdicts:\n${verdictsBlock}` +
    (tickerContext ? `\n\nTicker Knowledge:\n${tickerContext.slice(0, 400)}` : "") +
    calibrationBlock +
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
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : FALLBACK_CONFIDENCE,
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