/**
 * Forecaster diagnosis — why is directional accuracy near chance?
 *
 * Loads every resolved prediction across all users and breaks down:
 *  - production vs shadow (contamination check)
 *  - predicted-direction distribution (directional bias?)
 *  - confusion matrix: predicted vs realized effective direction (flat-band issue?)
 *  - directional accuracy + magnitude-hit, overall and by horizon
 *  - confidence calibration (stated band -> realized directional accuracy)
 *
 * Usage: npx tsx --env-file=.env.local scripts/diagnose-forecaster.ts
 */
import { hydrateSecrets } from "../lib/secrets";
import { createServiceClient } from "../lib/supabase/server";
import { getVaultStore } from "../lib/vault/store";
import { getDailyBars } from "../lib/marketdata/prices";
import { FLAT_BAND_PCT } from "../types/predictions";
import type { TickerPrediction, PredictionDirection } from "../types/predictions";

function effectiveDir(actualPct: number, flatBand: number): PredictionDirection {
  if (Math.abs(actualPct) <= flatBand) return "FLAT";
  return actualPct > 0 ? "UP" : "DOWN";
}

const PRED_RE = /^predictions\/[A-Z0-9.\-]+-\d+d\.json$/;

async function main() {
  await hydrateSecrets();
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("vault_notes").select("user_id").like("path", "predictions/%");
  if (error) throw error;
  const userIds = [...new Set((data ?? []).map((r) => r.user_id as string))];

  const all: TickerPrediction[] = [];
  for (const uid of userIds) {
    const store = await getVaultStore(uid);
    const notes = await store.listNotes("predictions/");
    for (const note of notes) {
      if (!PRED_RE.test(note.path)) continue;
      const raw = await store.read(note.path);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const arr: TickerPrediction[] = Array.isArray(parsed) ? parsed : parsed.predictions ?? [parsed];
        for (const p of arr) if (p && p.status === "resolved" && typeof p.actualPct === "number") all.push(p);
      } catch { /* skip */ }
    }
  }

  const prod = all.filter((p) => !p.shadow);
  const shadow = all.filter((p) => p.shadow);
  console.log(`\nResolved predictions: ${all.length}  (production ${prod.length}, shadow ${shadow.length})`);
  console.log(`Users with predictions: ${userIds.length}`);

  const analyze = (set: TickerPrediction[], label: string) => {
    if (set.length === 0) return;
    console.log(`\n=== ${label} (n=${set.length}) ===`);

    // Predicted-direction distribution
    const predDist: Record<string, number> = { UP: 0, DOWN: 0, FLAT: 0 };
    const realDist: Record<string, number> = { UP: 0, DOWN: 0, FLAT: 0 };
    // Confusion matrix predicted(row) x realized(col)
    const cm: Record<string, Record<string, number>> = {
      UP: { UP: 0, DOWN: 0, FLAT: 0 }, DOWN: { UP: 0, DOWN: 0, FLAT: 0 }, FLAT: { UP: 0, DOWN: 0, FLAT: 0 },
    };
    let dirHit = 0;
    for (const p of set) {
      const fb = p.flatBandPct ?? FLAT_BAND_PCT;
      const real = effectiveDir(p.actualPct!, fb);
      predDist[p.direction]++; realDist[real]++; cm[p.direction][real]++;
      if (real === p.direction) dirHit++;
    }
    console.log(`Predicted dir:  UP ${predDist.UP}  DOWN ${predDist.DOWN}  FLAT ${predDist.FLAT}`);
    console.log(`Realized dir:   UP ${realDist.UP}  DOWN ${realDist.DOWN}  FLAT ${realDist.FLAT}`);
    console.log(`Directional accuracy: ${((dirHit / set.length) * 100).toFixed(1)}%  (random 3-way ~33%)`);
    console.log("Confusion (rows=predicted, cols=realized):");
    console.log("           UP   DOWN  FLAT");
    for (const d of ["UP", "DOWN", "FLAT"] as const) {
      console.log(`  ${d.padEnd(5)} ${String(cm[d].UP).padStart(5)}${String(cm[d].DOWN).padStart(6)}${String(cm[d].FLAT).padStart(6)}`);
    }

    // By horizon
    const horizons = [...new Set(set.map((p) => p.horizonDays))].sort((a, b) => a - b);
    for (const h of horizons) {
      const sub = set.filter((p) => p.horizonDays === h);
      const hit = sub.filter((p) => effectiveDir(p.actualPct!, p.flatBandPct ?? FLAT_BAND_PCT) === p.direction).length;
      console.log(`  ${h}d: ${((hit / sub.length) * 100).toFixed(0)}% dir acc (n=${sub.length})`);
    }

    // Calibration: confidence band -> realized directional accuracy
    console.log("Calibration (stated conf -> realized dir acc):");
    for (let lo = 0.5; lo < 1.0; lo += 0.1) {
      const hi = lo + 0.1;
      const sub = set.filter((p) => p.confidence >= lo && p.confidence < hi + 1e-9);
      if (sub.length === 0) continue;
      const hit = sub.filter((p) => effectiveDir(p.actualPct!, p.flatBandPct ?? FLAT_BAND_PCT) === p.direction).length;
      console.log(`  ${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%: ${((hit / sub.length) * 100).toFixed(0)}% actual (n=${sub.length})`);
    }
  };

  analyze(prod, "PRODUCTION");
  analyze(shadow, "SHADOW");

  // Decisive check: are the forecaster's INPUTS bearish-capable? Tabulate the
  // verdicts of the catalysts each production prediction was given. If SELL is
  // near-zero, the forecaster is starved of bearish signal (upstream/classifier
  // problem) and loosening the FLAT gate cannot create a DOWN thesis.
  const verdictCount: Record<string, number> = {};
  let withAnySell = 0, withTwoSell = 0, withCatalysts = 0;
  for (const p of prod) {
    const cats = p.catalysts ?? [];
    if (cats.length) withCatalysts++;
    let sell = 0;
    for (const c of cats) {
      const v = (c.verdict ?? "?").toUpperCase();
      verdictCount[v] = (verdictCount[v] ?? 0) + 1;
      if (v === "SELL") sell++;
    }
    if (sell >= 1) withAnySell++;
    if (sell >= 2) withTwoSell++;
  }
  console.log(`\n=== CATALYST VERDICTS fed to PRODUCTION forecaster (n=${prod.length}) ===`);
  console.log(`Catalyst verdict totals:`, verdictCount);
  console.log(`Predictions with ≥1 SELL catalyst: ${withAnySell}/${prod.length}`);
  console.log(`Predictions with ≥2 SELL catalysts (the DOWN gate): ${withTwoSell}/${prod.length}`);
  console.log(`Predictions with any catalysts at all: ${withCatalysts}/${prod.length}`);

  // For realized-DOWN cases specifically: did they even have bearish input?
  const realizedDown = prod.filter((p) => effectiveDir(p.actualPct!, p.flatBandPct ?? FLAT_BAND_PCT) === "DOWN");
  let downWithSell = 0;
  for (const p of realizedDown) {
    if ((p.catalysts ?? []).some((c) => (c.verdict ?? "").toUpperCase() === "SELL")) downWithSell++;
  }
  console.log(`Realized-DOWN predictions: ${realizedDown.length}, of which had ≥1 SELL catalyst: ${downWithSell}`);

  // Momentum backtest — does the v3 hypothesis (price trend → direction) hold?
  // For each prediction, the 5-day return ENDING at prediction time. We then ask:
  // of realized-UP/DOWN moves, did prior 5d momentum point the same way
  // (trend-following has signal) or opposite (reversal — trend-following inverts)?
  console.log(`\n=== MOMENTUM BACKTEST (prior 5d trend vs realized direction) ===`);
  const barsCache = new Map<string, Awaited<ReturnType<typeof getDailyBars>>>();
  const tally: Record<string, { sameTrend: number; opposite: number; flat: number; total: number }> = {
    UP: { sameTrend: 0, opposite: 0, flat: 0, total: 0 },
    DOWN: { sameTrend: 0, opposite: 0, flat: 0, total: 0 },
  };
  const TREND_THRESH = 1.0; // % over 5d to count as a trend
  for (const p of prod) {
    const real = effectiveDir(p.actualPct!, p.flatBandPct ?? FLAT_BAND_PCT);
    if (real === "FLAT") continue;
    let bars = barsCache.get(p.ticker);
    if (!bars) { bars = await getDailyBars(p.ticker).catch(() => []); barsCache.set(p.ticker, bars); }
    if (!bars.length) continue;
    const day = new Date(p.runAt).toISOString().slice(0, 10);
    let i = -1;
    for (let k = bars.length - 1; k >= 0; k--) { if (bars[k].date <= day) { i = k; break; } }
    if (i < 5) continue;
    const prior5 = ((bars[i].close - bars[i - 5].close) / bars[i - 5].close) * 100;
    const trend: PredictionDirection = prior5 > TREND_THRESH ? "UP" : prior5 < -TREND_THRESH ? "DOWN" : "FLAT";
    const t = tally[real];
    t.total++;
    if (trend === "FLAT") t.flat++;
    else if (trend === real) t.sameTrend++;
    else t.opposite++;
  }
  for (const dir of ["UP", "DOWN"] as const) {
    const t = tally[dir];
    if (t.total === 0) continue;
    console.log(
      `Realized ${dir} (n=${t.total}): prior 5d trend was SAME ${t.sameTrend} (${Math.round(100 * t.sameTrend / t.total)}%), ` +
        `OPPOSITE ${t.opposite} (${Math.round(100 * t.opposite / t.total)}%), flat ${t.flat}`,
    );
  }
  console.log(`(SAME% > OPPOSITE% ⇒ trend-following has signal and v3 helps; OPPOSITE dominant ⇒ moves are reversals, v3 would invert.)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
