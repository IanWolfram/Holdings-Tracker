import type { VaultStore } from "@/lib/vault/store";
import type { CatalystType, TickerPrediction } from "../types/predictions";

interface MutableStats {
  n: number;
  correct: number;
  partial: number;
  incorrect: number;
  confidenceTotal: number;
}

export interface CalibrationStats {
  n: number;
  correct: number;
  partial: number;
  incorrect: number;
  winRate: number;
  avgConfidence: number;
}

export interface CalibrationReport {
  updatedAt: string;
  totalResolved: number;
  byTicker: Record<string, CalibrationStats>;
  byCatalyst: Record<string, CalibrationStats>;
  byConfidenceBucket: Record<string, CalibrationStats>;
  byHorizon: Record<string, CalibrationStats>;
  byEngine: Record<string, CalibrationStats>;
}

function createStats(): MutableStats {
  return {
    n: 0,
    correct: 0,
    partial: 0,
    incorrect: 0,
    confidenceTotal: 0,
  };
}

function toStats(source: MutableStats): CalibrationStats {
  const n = source.n;
  return {
    n,
    correct: source.correct,
    partial: source.partial,
    incorrect: source.incorrect,
    winRate: n > 0 ? Number((source.correct / n).toFixed(4)) : 0,
    avgConfidence: n > 0 ? Number((source.confidenceTotal / n).toFixed(4)) : 0,
  };
}

function confidenceBucket(confidence: number): string {
  const clamped = Math.max(0, Math.min(0.999, confidence));
  const lower = Math.floor(clamped * 10) / 10;
  const upper = lower + 0.1;
  return `${lower.toFixed(1)}-${upper.toFixed(1)}`;
}

function updateStats(stats: MutableStats, prediction: TickerPrediction): void {
  stats.n += 1;
  stats.confidenceTotal += prediction.confidence;
  if (prediction.outcome === "CORRECT") stats.correct += 1;
  else if (prediction.outcome === "PARTIAL") stats.partial += 1;
  else stats.incorrect += 1;
}

function asRecord(map: Map<string, MutableStats>): Record<string, CalibrationStats> {
  const out: Record<string, CalibrationStats> = {};
  for (const [key, value] of map.entries()) {
    out[key] = toStats(value);
  }
  return out;
}

function monthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7);
}

function getPredictionCatalystTypes(prediction: TickerPrediction): CatalystType[] {
  if (prediction.catalystTypes && prediction.catalystTypes.length > 0) {
    return [...new Set(prediction.catalystTypes)];
  }

  const catalysts = prediction.catalysts ?? [];
  const fromCatalysts = catalysts
    .flatMap((catalyst) => catalyst.catalystTypes ?? [])
    .filter(Boolean);

  return fromCatalysts.length > 0 ? [...new Set(fromCatalysts)] : ["other"];
}

async function collectResolvedPredictions(store: VaultStore): Promise<TickerPrediction[]> {
  const notes = await store.listNotes("predictions/");
  const resolved: TickerPrediction[] = [];

  for (const note of notes) {
    try {
      const parsed = JSON.parse(note.body) as unknown;
      if (!Array.isArray(parsed)) continue;

      for (const value of parsed) {
        if (!value || typeof value !== "object") continue;
        const prediction = value as TickerPrediction;
        if (prediction.status !== "resolved") continue;
        // Shadow predictions trial a new forecaster version — they are evaluated
        // separately (scripts/compare-forecaster-versions.ts) and must never
        // contaminate the live calibration report shown to the model/UI.
        if (prediction.shadow) continue;
        if (typeof prediction.confidence !== "number") continue;
        if (!prediction.outcome) continue;
        resolved.push(prediction);
      }
    } catch {
      // Ignore malformed files so one bad ticker does not block calibration updates.
    }
  }

  return resolved;
}

async function writeMonthlySummary(
  store: VaultStore,
  resolvedPredictions: TickerPrediction[],
  report: CalibrationReport
): Promise<void> {
  const monthly = resolvedPredictions.filter((prediction) => {
    const referenceTime = prediction.resolvedAt ?? prediction.runAt;
    return monthKey(referenceTime) === monthKey(Date.now());
  });

  const month = monthKey(Date.now());
  const monthlyCorrect = monthly.filter((prediction) => prediction.outcome === "CORRECT").length;
  const monthlyRate = monthly.length > 0 ? (monthlyCorrect / monthly.length) * 100 : 0;

  const catalystLeaders = Object.entries(report.byCatalyst)
    .filter(([, stats]) => stats.n >= 2)
    .sort((a, b) => b[1].winRate - a[1].winRate)
    .slice(0, 3);

  const catalystLaggards = Object.entries(report.byCatalyst)
    .filter(([, stats]) => stats.n >= 2)
    .sort((a, b) => a[1].winRate - b[1].winRate)
    .slice(0, 3);

  const content = [
    "---",
    `month: "${month}"`,
    "type: calibration-monthly",
    `resolvedCount: ${monthly.length}`,
    `winRate: ${monthlyRate.toFixed(2)}`,
    "tags:",
    "  - calibration",
    "  - monthly",
    "---",
    "",
    `# Calibration Report - ${month}`,
    "",
    `Resolved predictions this month: ${monthly.length}`,
    `Correct predictions this month: ${monthlyCorrect}`,
    `Monthly win rate: ${monthlyRate.toFixed(2)}%`,
    "",
    "## Top Catalyst Accuracy",
    ...(catalystLeaders.length > 0
      ? catalystLeaders.map(
          ([type, stats]) =>
            `- ${type}: ${(stats.winRate * 100).toFixed(1)}% win rate (n=${stats.n})`
        )
      : ["- Insufficient catalyst data this month."]),
    "",
    "## Weakest Catalyst Accuracy",
    ...(catalystLaggards.length > 0
      ? catalystLaggards.map(
          ([type, stats]) =>
            `- ${type}: ${(stats.winRate * 100).toFixed(1)}% win rate (n=${stats.n})`
        )
      : ["- Insufficient catalyst data this month."]),
    "",
  ].join("\n");

  await store.write(`_metrics/MONTHLY-${month}.md`, content);
}

let cachedReport: { data: CalibrationReport | null; expiresAt: number } | null = null;
const REPORT_CACHE_TTL_MS = 60_000;

export async function loadCalibrationReport(store: VaultStore): Promise<CalibrationReport | null> {
  const now = Date.now();
  if (cachedReport && cachedReport.expiresAt > now) {
    return cachedReport.data;
  }

  let report: CalibrationReport | null = null;
  try {
    const raw = await store.read("_metrics/calibration.json");
    if (raw !== null) {
      const parsed = JSON.parse(raw) as CalibrationReport;
      if (parsed && typeof parsed === "object" && "totalResolved" in parsed) {
        report = parsed;
      }
    }
  } catch {
    report = null;
  }

  cachedReport = { data: report, expiresAt: now + REPORT_CACHE_TTL_MS };
  return report;
}

export function invalidateCalibrationCache(): void {
  cachedReport = null;
}

/**
 * Returns a multiplier in (0, 1] for `rawConfidence`, derived from how the matching
 * confidence bucket has actually performed. Used to deterministically shrink
 * overconfident buckets toward their observed directional win rate — the advisory
 * calibration text alone is unreliable with a cheap model, so the correction is
 * applied to the numeric output instead of trusting the LLM.
 *
 * Shrink-only: a bucket whose observed win rate meets or beats its stated
 * confidence is left untouched (factor 1), so we never inflate. Gated on at least
 * 3 samples in the bucket (mirrors the sample floor in buildCalibrationBlock) and
 * a handful of total resolved predictions, so cold-start runs are unaffected.
 */
/**
 * Aggregate overall (win rate, avg stated confidence) across all confidence
 * buckets. Used as a fallback when the specific bucket is too thin to trust on
 * its own — overconfidence in this system is systemic, so the overall gap is a
 * reasonable prior for a sparsely-populated bucket.
 */
function overallConfidenceGap(
  report: CalibrationReport
): { winRate: number; avgConfidence: number; n: number } | null {
  let n = 0;
  let correct = 0;
  let confSum = 0;
  for (const stats of Object.values(report.byConfidenceBucket)) {
    n += stats.n;
    correct += stats.correct;
    confSum += stats.avgConfidence * stats.n;
  }
  if (n === 0) return null;
  return { winRate: correct / n, avgConfidence: confSum / n, n };
}

export function getConfidenceReliabilityFactor(
  report: CalibrationReport | null,
  rawConfidence: number
): number {
  if (!report || report.totalResolved < 5) return 1;

  const stats = report.byConfidenceBucket[confidenceBucket(rawConfidence)];

  // Midpoint of the 0.1-wide bucket this confidence falls into.
  const clamped = Math.max(0, Math.min(0.999, rawConfidence));
  const midpoint = Math.floor(clamped * 10) / 10 + 0.05;

  // Primary: correct overconfidence using THIS bucket's observed win rate.
  if (stats && stats.n >= 3) {
    if (stats.winRate >= midpoint) return 1;
    return stats.winRate / midpoint;
  }

  // Fallback: the bucket is too thin, but the model is systemically
  // overconfident. Shrink toward the overall observed win-rate / stated-
  // confidence ratio so a sparse bucket still gets grounded. Gated on enough
  // total resolved predictions so cold-start runs are untouched.
  const overall = overallConfidenceGap(report);
  if (!overall || overall.n < 8 || overall.avgConfidence <= 0) return 1;
  if (overall.winRate >= overall.avgConfidence) return 1;
  return overall.winRate / overall.avgConfidence;
}

function pctString(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export async function buildCalibrationBlock(ticker: string, store: VaultStore): Promise<string> {
  const report = await loadCalibrationReport(store);
  if (!report || report.totalResolved < 2) return "";

  const overallCorrect = Object.values(report.byTicker).reduce(
    (sum, stats) => sum + stats.correct,
    0
  );
  const overallRate = report.totalResolved > 0 ? overallCorrect / report.totalResolved : 0;

  const buckets = Object.entries(report.byConfidenceBucket)
    .filter(([, stats]) => stats.n >= 3)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, stats]) => `  - ${bucket}: ${pctString(stats.winRate)} (n=${stats.n})`);

  const catalystEntries = Object.entries(report.byCatalyst)
    .filter(([type, stats]) => stats.n >= 2 && type !== "other")
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 6);

  const catalystLines = catalystEntries.map(([type, stats]) => {
    const tag = stats.winRate < 0.4 ? " (DOWNWEIGHT)" : stats.winRate > 0.65 ? " (TRUSTED)" : "";
    return `  - ${type}: ${pctString(stats.winRate)} accurate (n=${stats.n})${tag}`;
  });

  const tickerStats = report.byTicker[ticker];
  const tickerLine = tickerStats
    ? `For ${ticker} specifically: ${tickerStats.correct}/${tickerStats.n} correct (${pctString(tickerStats.winRate)}), avg confidence ${tickerStats.avgConfidence.toFixed(2)}.`
    : `No prior resolved predictions for ${ticker}; treat as cold-start.`;

  const lines = [
    "## Your Calibration",
    `You have made ${report.totalResolved} resolved predictions. Overall win rate: ${pctString(overallRate)}.`,
  ];

  if (report.totalResolved < 5) {
    lines.push("_Cold-start: too few resolved predictions for reliable calibration. Treat these stats as preliminary._");
  }

  if (buckets.length > 0) {
    lines.push("By confidence bucket:");
    lines.push(...buckets);
  }
  if (catalystLines.length > 0) {
    lines.push("By catalyst:");
    lines.push(...catalystLines);
  }
  lines.push(tickerLine);

  return `\n\n${lines.join("\n")}`;
}

export async function updateCalibration(store: VaultStore): Promise<CalibrationReport> {
  const resolvedPredictions = await collectResolvedPredictions(store);

  const byTicker = new Map<string, MutableStats>();
  const byCatalyst = new Map<string, MutableStats>();
  const byConfidenceBucket = new Map<string, MutableStats>();
  const byHorizon = new Map<string, MutableStats>();
  const byEngine = new Map<string, MutableStats>();

  for (const prediction of resolvedPredictions) {
    const tickerKey = prediction.ticker;
    const tickerStats = byTicker.get(tickerKey) ?? createStats();
    updateStats(tickerStats, prediction);
    byTicker.set(tickerKey, tickerStats);

    const bucketKey = confidenceBucket(prediction.confidence);
    const bucketStats = byConfidenceBucket.get(bucketKey) ?? createStats();
    updateStats(bucketStats, prediction);
    byConfidenceBucket.set(bucketKey, bucketStats);

    const horizonKey = `${prediction.horizonDays}d`;
    const horizonStats = byHorizon.get(horizonKey) ?? createStats();
    updateStats(horizonStats, prediction);
    byHorizon.set(horizonKey, horizonStats);

    const engineKey = prediction.engine || "unknown";
    const engineStats = byEngine.get(engineKey) ?? createStats();
    updateStats(engineStats, prediction);
    byEngine.set(engineKey, engineStats);

    for (const catalystType of getPredictionCatalystTypes(prediction)) {
      const catalystStats = byCatalyst.get(catalystType) ?? createStats();
      updateStats(catalystStats, prediction);
      byCatalyst.set(catalystType, catalystStats);
    }
  }

  const report: CalibrationReport = {
    updatedAt: new Date().toISOString(),
    totalResolved: resolvedPredictions.length,
    byTicker: asRecord(byTicker),
    byCatalyst: asRecord(byCatalyst),
    byConfidenceBucket: asRecord(byConfidenceBucket),
    byHorizon: asRecord(byHorizon),
    byEngine: asRecord(byEngine),
  };

  await store.write("_metrics/calibration.json", JSON.stringify(report, null, 2));
  await writeMonthlySummary(store, resolvedPredictions, report);
  invalidateCalibrationCache();
  return report;
}