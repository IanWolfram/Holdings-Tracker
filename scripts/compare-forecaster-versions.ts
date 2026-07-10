/**
 * Forecaster A/B harness — scores v1 (production) vs v2 (shadow) vs a naive
 * always-FLAT baseline under IDENTICAL scoring rules, so the comparison isolates
 * forecaster quality rather than a change in how we score.
 *
 * Every prediction is RE-SCORED from daily bars here (horizon-date close +
 * volatility-scaled FLAT band) rather than trusting the stored `outcome`, so the
 * numbers reflect the current resolution rules regardless of when/how a
 * prediction was originally resolved. That makes this also the verification step
 * for the resolution-window and vol-band changes.
 *
 * Reads live data straight from Supabase `vault_notes` (where predictions
 * actually live in cloud mode), across all users.
 *
 * Usage:
 *   npx tsx scripts/compare-forecaster-versions.ts
 */
import { createClient } from "@supabase/supabase-js";
import { getDailyBars, type DailyBar } from "../lib/marketdata/prices";
import { findBarOnOrAfter, flatBandFromBars } from "../lib/marketdata/volatility";
import { computePredictionOutcome } from "../world-brain/predictions";
import type { PredictionOutcome, TickerPrediction } from "../types/predictions";
import { hydrateSecrets } from "../lib/secrets";
import { directionalStats, type DirectionalStats } from "../world-brain/forecaster-metrics";

// Promotion gate is on DIRECTIONAL PRECISION + EDGE, not overall dirAcc. A
// FLAT-heavy variant always wins overall accuracy at 1–7d (FLAT is the
// majority-correct class), so that axis can never surface a forecaster with
// genuine directional edge. The candidate is promoted only when, on the calls it
// actually COMMITS (UP/DOWN), it is (a) statistically better than a coin flip,
// (b) beats production precision, and (c) makes money per call (positive edge).
const MIN_DIRECTIONAL = 15; // candidate needs ≥ this many committed UP/DOWN calls.
const CI_FLOOR = 0.5; // candidate precision Wilson-95 lower bound must exceed this.
const PRECISION_MARGIN = 0.05; // candidate precision must beat v1 by ≥ this.
// The current candidate. Bump this when a new forecaster recipe ships so the
// comparison isolates IT and ignores stale earlier candidates (e.g. the retired
// v2, whose framing differed). The "v2" bucket label below means "the candidate".
// NOTE: v4 shipped STRAIGHT TO PRODUCTION (2026-07-09, no shadow lane), so the
// candidate bucket now matches by version label whether or not the prediction
// was a shadow — this script is v4's retrospective vs-prior-production check.
const CANDIDATE_VERSION = "v4";

function dateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// "v1" bucket = prior production lineage (any non-shadow, non-candidate
// prediction — production was "v1" pre-2026-06-25, "v3" until 2026-07-09);
// "v2" bucket = the current candidate (CANDIDATE_VERSION, shadow or production);
// null = legacy shadow from a retired candidate, excluded so the A/B stays clean.
function versionOf(p: TickerPrediction): "v1" | "v2" | null {
  if (p.version === CANDIDATE_VERSION) return "v2";
  if (!p.shadow) return "v1";
  return null;
}

interface Scored {
  key: string; // ticker|horizon|runAt — identifies the same forecast across versions
  version: "v1" | "v2";
  ticker: string;
  horizonDays: number;
  direction: TickerPrediction["direction"];
  magnitudePct: number;
  confidence: number;
  actualPct: number;
  band: number;
  outcome: PredictionOutcome;
}

interface Metrics {
  n: number;
  correct: number;
  partial: number;
  incorrect: number;
  winRate: number; // CORRECT / n
  dirAcc: number; // (CORRECT + PARTIAL) / n  — got the direction right
  avgConfidence: number;
}

function computeMetrics(items: Scored[]): Metrics {
  const n = items.length;
  let correct = 0,
    partial = 0,
    incorrect = 0,
    conf = 0;
  for (const it of items) {
    conf += it.confidence;
    if (it.outcome === "CORRECT") correct++;
    else if (it.outcome === "PARTIAL") partial++;
    else incorrect++;
  }
  return {
    n,
    correct,
    partial,
    incorrect,
    winRate: n ? correct / n : 0,
    dirAcc: n ? (correct + partial) / n : 0,
    avgConfidence: n ? conf / n : 0,
  };
}

/** Directional precision on a re-scored set — see world-brain/forecaster-metrics. */
function directionalReport(items: Scored[]): DirectionalStats {
  return directionalStats(
    items.map((s) => ({ direction: s.direction, actualPct: s.actualPct, horizonDays: s.horizonDays }))
  );
}

function fmtDir(d: DirectionalStats): string {
  return (
    `n=${d.n}  precision=${(d.precision * 100).toFixed(1)}%  ` +
    `(95% CI ${(d.ci95[0] * 100).toFixed(0)}–${(d.ci95[1] * 100).toFixed(0)}%)  ` +
    `edge=${d.edgePct >= 0 ? "+" : ""}${d.edgePct.toFixed(2)}%/call`
  );
}

/** Always-FLAT counterfactual on the same set, scored under the same bands. */
function baselineFlat(items: Scored[]): Metrics {
  const flat = items.map((it) => ({
    ...it,
    direction: "FLAT" as const,
    magnitudePct: 0,
    confidence: 0,
    outcome: computePredictionOutcome("FLAT", 0, it.actualPct, it.band),
  }));
  return computeMetrics(flat);
}

function fmt(m: Metrics): string {
  return `n=${m.n}  win=${(m.winRate * 100).toFixed(1)}%  dirAcc=${(m.dirAcc * 100).toFixed(1)}%  (C${m.correct}/P${m.partial}/I${m.incorrect})  avgConf=${m.avgConfidence.toFixed(2)}`;
}

async function main(): Promise<void> {
  // Connection vars come from the real environment (process.env); everything
  // else (FINNHUB_API_KEY, DeepSeek, …) is hydrated from Supabase `app_secrets`.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[compare] Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
    process.exit(1);
  }
  await hydrateSecrets();
  const sb = createClient(url, key);

  const { data, error } = await sb
    .from("vault_notes")
    .select("body")
    .like("path", "predictions/%");
  if (error) {
    console.error("[compare] Query failed:", error.message);
    process.exit(1);
  }

  const all: TickerPrediction[] = [];
  for (const row of data ?? []) {
    try {
      const arr = JSON.parse(row.body);
      if (Array.isArray(arr)) all.push(...arr);
    } catch {
      /* skip malformed */
    }
  }

  // Re-score everything from bars under the current rules.
  const barCache = new Map<string, DailyBar[]>();
  const scored: Scored[] = [];
  let noBars = 0; // bar fetch failed / insufficient history — a DATA gap, can bias the sample
  let futureHorizon = 0; // horizon date not reached yet — legitimately unresolvable
  const noBarsTickers = new Set<string>();
  for (const p of all) {
    if (typeof p.priceAtPrediction !== "number" || !p.runAt || !p.horizonDays) continue;
    const ver = versionOf(p);
    if (ver === null) continue; // legacy shadow candidate — excluded from the clean A/B
    let bars = barCache.get(p.ticker);
    if (!bars) {
      bars = await getDailyBars(p.ticker, 730).catch(() => []);
      barCache.set(p.ticker, bars);
    }
    if (!bars || bars.length < 20) {
      noBars++;
      noBarsTickers.add(p.ticker);
      continue;
    }
    const targetDate = dateKey(p.runAt + p.horizonDays * 86_400_000);
    const resBar = findBarOnOrAfter(bars, targetDate);
    if (!resBar) {
      futureHorizon++; // horizon date not reached / no bar yet — expected, not a data gap
      continue;
    }
    const actualPct = ((resBar.close - p.priceAtPrediction) / p.priceAtPrediction) * 100;
    const band = flatBandFromBars(bars, dateKey(p.runAt), p.horizonDays);
    const outcome = computePredictionOutcome(p.direction, p.magnitudePct, actualPct, band);
    scored.push({
      key: `${p.ticker}|${p.horizonDays}|${p.runAt}`,
      version: ver,
      ticker: p.ticker,
      horizonDays: p.horizonDays,
      direction: p.direction,
      magnitudePct: p.magnitudePct,
      confidence: p.confidence,
      actualPct,
      band,
      outcome,
    });
  }

  const v1 = scored.filter((s) => s.version === "v1");
  const v2 = scored.filter((s) => s.version === "v2");

  console.log("=== Forecaster comparison (re-scored under current rules) ===");
  console.log(
    `Re-scored: ${scored.length}  | future-horizon (not due yet): ${futureHorizon}  | ` +
      `no-bars (DATA GAP): ${noBars}${noBars ? ` [${[...noBarsTickers].join(", ")}]` : ""}`,
  );
  if (noBars > 0) {
    console.log(
      "  ⚠ no-bars rows were dropped — if from rate-limiting, the resolved set is biased. Re-run to confirm stability.",
    );
  }
  console.log("");

  // Headline forecaster metric: directional precision (edge when it commits).
  // Overall win/dirAcc is shown too, but always-FLAT structurally wins that axis
  // at short horizons (FLAT is the majority-correct class), so it is NOT the test.
  const dV1 = directionalReport(v1);
  const dV2 = directionalReport(v2);
  console.log("DIRECTIONAL PRECISION — the test that matters (always-FLAT can't compete here):");
  console.log("  v1:", fmtDir(dV1));
  if (v2.length) console.log("  v2:", fmtDir(dV2));
  console.log("");

  console.log("Overall accuracy (context only — FLAT is the majority class):");
  console.log("  ALL v1 (production):", fmt(computeMetrics(v1)));
  console.log("    always-FLAT baseline:", fmt(baselineFlat(v1)));
  console.log("  ALL v2 (shadow):     ", fmt(computeMetrics(v2)));
  if (v2.length) console.log("    always-FLAT baseline:", fmt(baselineFlat(v2)));

  // Head-to-head on matched forecasts (same ticker/horizon/runAt in both versions).
  const v2Keys = new Set(v2.map((s) => s.key));
  const pairedV1 = v1.filter((s) => v2Keys.has(s.key));
  const v1Keys = new Set(v1.map((s) => s.key));
  const pairedV2 = v2.filter((s) => v1Keys.has(s.key));

  console.log(`\n=== Head-to-head (matched pairs: ${pairedV1.length}, context only) ===`);
  if (pairedV1.length === 0) {
    console.log("No matched v1/v2 pairs yet — run agent sweeps so v2 shadows accumulate.");
  } else {
    console.log("v1:        ", fmt(computeMetrics(pairedV1)));
    console.log("v2:        ", fmt(computeMetrics(pairedV2)));
    console.log("always-FLAT:", fmt(baselineFlat(pairedV1)));
  }

  // === Promotion gate: directional precision + edge on each version's OWN
  // committed calls (matched pairs above are context — overall dirAcc favors the
  // FLAT-heavy variant and would never promote a forecaster with real edge). ===
  console.log("\n=== Promotion recommendation (gate: directional precision + edge) ===");
  const ciLowerPct = (dV2.ci95[0] * 100).toFixed(0);
  if (!v2.length) {
    console.log("HOLD — no candidate (v2) predictions yet. Run agent sweeps so the shadow accumulates.");
  } else if (dV2.n < MIN_DIRECTIONAL) {
    console.log(
      `HOLD — candidate committed only ${dV2.n} UP/DOWN calls (<${MIN_DIRECTIONAL}). ` +
        `Precision (${(dV2.precision * 100).toFixed(1)}%, 95% CI lower ${ciLowerPct}%) needs more commits to be trustworthy.`
    );
  } else {
    const beatsCoinFlip = dV2.ci95[0] > CI_FLOOR;
    const beatsV1 = dV2.precision - dV1.precision >= PRECISION_MARGIN;
    const positiveEdge = dV2.edgePct > 0;
    if (beatsCoinFlip && beatsV1 && positiveEdge) {
      console.log(
        `PROMOTE candidate → v1: precision ${(dV2.precision * 100).toFixed(1)}% ` +
          `(95% CI lower ${ciLowerPct}% > ${(CI_FLOOR * 100).toFixed(0)}%), ` +
          `+${((dV2.precision - dV1.precision) * 100).toFixed(1)}pp over v1, ` +
          `edge ${dV2.edgePct >= 0 ? "+" : ""}${dV2.edgePct.toFixed(2)}%/call.`
      );
    } else {
      const fails: string[] = [];
      if (!beatsCoinFlip) fails.push(`95% CI lower bound ${ciLowerPct}% ≤ ${(CI_FLOOR * 100).toFixed(0)}% (not beating a coin flip)`);
      if (!beatsV1) fails.push(`precision only +${((dV2.precision - dV1.precision) * 100).toFixed(1)}pp over v1 (need ≥${(PRECISION_MARGIN * 100).toFixed(0)}pp)`);
      if (!positiveEdge) fails.push(`edge ${dV2.edgePct.toFixed(2)}%/call ≤ 0`);
      console.log(`KEEP v1: ${fails.join("; ")}.`);
    }
  }
}

main().catch((err) => {
  console.error("[compare] Fatal error:", err);
  process.exit(1);
});
