/**
 * Forecaster directional-skill metrics + time-series snapshots.
 *
 * Overall win-rate is the wrong yardstick for this forecaster: at 1–7d horizons
 * most moves are small, so the majority-correct class is FLAT and a plain
 * accuracy metric rewards predicting FLAT regardless of band width. The metric
 * that actually measures the forecaster is **directional precision** — when it
 * commits to UP/DOWN, does it have edge? An always-FLAT strategy makes zero
 * directional calls, so it can't compete on this axis.
 *
 * Because directional samples accumulate slowly (a forecaster verdict only
 * becomes statistically real around ~50+ directional calls), we also append a
 * timestamped snapshot to `_metrics/forecaster-history.json` on each resolution
 * run, so the precision and its confidence interval can be watched tightening
 * over time instead of being re-derived by hand.
 */
import type { TickerPrediction } from "../types/predictions";

export interface DirectionalSample {
  direction: TickerPrediction["direction"];
  actualPct: number;
}

export interface DirectionalStats {
  n: number; // number of UP/DOWN calls (FLAT excluded)
  precision: number; // fraction with sign(actual) == predicted sign
  ci95: [number, number]; // Wilson 95% interval on precision
  edgePct: number; // mean signed |move| of taking the call (right→+|move|, wrong→−|move|)
}

/** Wilson 95% score interval for a binomial proportion — honest small-n bounds. */
export function wilson95(successes: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

/**
 * Directional precision over a set of resolved samples. precision is the raw
 * sign hit-rate (band-independent, so it isolates the forecaster from scoring);
 * edgePct magnitude-weights it so a missed 8% move costs more than a 1% wobble.
 */
export function directionalStats(samples: DirectionalSample[]): DirectionalStats {
  const dir = samples.filter((s) => s.direction === "UP" || s.direction === "DOWN");
  let hit = 0;
  let edgeSum = 0;
  for (const s of dir) {
    const sign = s.direction === "UP" ? 1 : -1;
    const right = Math.sign(s.actualPct) === sign;
    if (right) hit++;
    edgeSum += right ? Math.abs(s.actualPct) : -Math.abs(s.actualPct);
  }
  const n = dir.length;
  return {
    n,
    precision: n ? hit / n : 0,
    ci95: wilson95(hit, n),
    edgePct: n ? edgeSum / n : 0,
  };
}

export interface ForecasterSnapshot extends DirectionalStats {
  ts: string; // ISO timestamp of the snapshot
  resolvedTotal: number; // all resolved non-shadow predictions considered (incl. FLAT)
}

const HISTORY_PATH = "_metrics/forecaster-history.json";
const HISTORY_CAP = 730; // keep ~2y of daily snapshots

/**
 * Read every resolved (non-shadow, v1) prediction from a user's vault and reduce
 * to directional samples. actualPct is taken straight off the resolved record
 * (set by `resolveEligiblePredictions`), so no bars need re-fetching.
 */
async function collectResolvedSamples(store: {
  listNotes(prefix: string): Promise<{ body: string }[]>;
}): Promise<{ samples: DirectionalSample[]; resolvedTotal: number }> {
  const notes = await store.listNotes("predictions/");
  const samples: DirectionalSample[] = [];
  let resolvedTotal = 0;
  for (const note of notes) {
    let arr: TickerPrediction[];
    try {
      arr = JSON.parse(note.body);
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      if (p.shadow || p.version === "v2") continue; // production forecaster only
      if (!p.outcome || typeof p.actualPct !== "number") continue; // resolved only
      resolvedTotal++;
      samples.push({ direction: p.direction, actualPct: p.actualPct });
    }
  }
  return { samples, resolvedTotal };
}

/** Compute the current directional snapshot for a user's vault. */
export async function computeForecasterSnapshot(
  store: { listNotes(prefix: string): Promise<{ body: string }[]> },
  nowMs: number = Date.now(),
): Promise<ForecasterSnapshot | null> {
  const { samples, resolvedTotal } = await collectResolvedSamples(store);
  if (resolvedTotal === 0) return null;
  const stats = directionalStats(samples);
  return { ts: new Date(nowMs).toISOString(), resolvedTotal, ...stats };
}

/**
 * Compute and append a directional snapshot to `_metrics/forecaster-history.json`.
 * No-ops (returns null) when the user has no resolved predictions yet. Idempotent
 * within a calendar day: re-running replaces same-day snapshot rather than piling
 * duplicates, so the history reflects one point per resolution day.
 */
export async function appendForecasterSnapshot(
  store: {
    listNotes(prefix: string): Promise<{ body: string }[]>;
    read(path: string): Promise<string | null>;
    write(path: string, body: string): Promise<void>;
  },
  nowMs: number = Date.now(),
): Promise<ForecasterSnapshot | null> {
  const snapshot = await computeForecasterSnapshot(store, nowMs);
  if (!snapshot) return null;

  let history: ForecasterSnapshot[] = [];
  try {
    const raw = await store.read(HISTORY_PATH);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) history = parsed;
    }
  } catch {
    history = [];
  }

  const today = snapshot.ts.slice(0, 10);
  history = history.filter((s) => s.ts.slice(0, 10) !== today);
  history.push(snapshot);
  if (history.length > HISTORY_CAP) history = history.slice(-HISTORY_CAP);

  await store.write(HISTORY_PATH, JSON.stringify(history, null, 2));
  return snapshot;
}
