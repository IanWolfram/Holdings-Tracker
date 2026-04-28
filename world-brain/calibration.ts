import fs from "fs";
import path from "path";
import { resolveVaultPath } from "../lib/constants";
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

function metricsDir(vaultPath: string): string {
  return path.join(vaultPath, "_metrics");
}

function predictionDir(vaultPath: string): string {
  return path.join(vaultPath, "predictions");
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

function collectResolvedPredictions(vaultPath: string): TickerPrediction[] {
  const dir = predictionDir(vaultPath);
  if (!fs.existsSync(dir)) return [];

  const resolved: TickerPrediction[] = [];
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".json"));
  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;

      for (const value of parsed) {
        if (!value || typeof value !== "object") continue;
        const prediction = value as TickerPrediction;
        if (prediction.status !== "resolved") continue;
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

function writeMonthlySummary(
  vaultPath: string,
  resolvedPredictions: TickerPrediction[],
  report: CalibrationReport
): void {
  const monthly = resolvedPredictions.filter((prediction) => {
    const referenceTime = prediction.resolvedAt ?? prediction.runAt;
    return monthKey(referenceTime) === monthKey(Date.now());
  });

  const month = monthKey(Date.now());
  const notePath = path.join(metricsDir(vaultPath), `MONTHLY-${month}.md`);
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
    `month: \"${month}\"`,
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

  fs.writeFileSync(notePath, content, "utf-8");
}

let cachedReport: { data: CalibrationReport | null; expiresAt: number } | null = null;
const REPORT_CACHE_TTL_MS = 60_000;

export function loadCalibrationReport(vaultPath: string): CalibrationReport | null {
  const now = Date.now();
  if (cachedReport && cachedReport.expiresAt > now) {
    return cachedReport.data;
  }

  const resolvedVault = resolveVaultPath(vaultPath) ?? vaultPath;
  const calibrationPath = path.join(metricsDir(resolvedVault), "calibration.json");

  let report: CalibrationReport | null = null;
  try {
    const raw = fs.readFileSync(calibrationPath, "utf-8");
    const parsed = JSON.parse(raw) as CalibrationReport;
    if (parsed && typeof parsed === "object" && "totalResolved" in parsed) {
      report = parsed;
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

function pctString(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function buildCalibrationBlock(ticker: string, vaultPath: string): string {
  const report = loadCalibrationReport(vaultPath);
  if (!report || report.totalResolved < 5) return "";

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

export function updateCalibration(vaultPath: string): CalibrationReport {
  const resolvedVault = resolveVaultPath(vaultPath) ?? vaultPath;
  const resolvedPredictions = collectResolvedPredictions(resolvedVault);

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

  fs.mkdirSync(metricsDir(resolvedVault), { recursive: true });
  const calibrationPath = path.join(metricsDir(resolvedVault), "calibration.json");
  const tmpPath = `${calibrationPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(report, null, 2), "utf-8");
  fs.renameSync(tmpPath, calibrationPath);

  writeMonthlySummary(resolvedVault, resolvedPredictions, report);
  invalidateCalibrationCache();
  return report;
}