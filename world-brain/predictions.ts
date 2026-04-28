import fs from "fs";
import path from "path";
import { resolveVaultPath } from "../lib/constants";
import { classifyCatalystTypes } from "./catalyst-classifier";
import type {
  CatalystType,
  TickerPrediction,
  PredictionOutcome,
} from "../types/predictions";
import { FLAT_BAND_PCT, CORRECT_DIRECTION_MAGNITUDE_RATIO } from "../types/predictions";

export const SUPPORTED_HORIZONS = [1, 7, 30] as const;
export type SupportedHorizon = (typeof SUPPORTED_HORIZONS)[number];
const DEFAULT_HORIZON: SupportedHorizon = 7;

function predictionsDir(vaultPath: string): string {
  const resolved = resolveVaultPath(vaultPath) ?? vaultPath;
  return path.join(resolved, "predictions");
}

function predictionsFile(vaultPath: string, ticker: string, horizon: number): string {
  return path.join(predictionsDir(vaultPath), `${ticker}-${horizon}d.json`);
}

function legacyPredictionsFile(vaultPath: string, ticker: string): string {
  return path.join(predictionsDir(vaultPath), `${ticker}.json`);
}

// One-shot migration: rename {ticker}.json → {ticker}-7d.json the first time
// we touch a ticker. Idempotent: skips if the legacy file is gone or the new
// file already exists. The migrated file is treated as the 7-day horizon since
// every existing record in those files has horizonDays: 7.
function migrateLegacyTickerFile(vaultPath: string, ticker: string): void {
  const legacy = legacyPredictionsFile(vaultPath, ticker);
  const target = predictionsFile(vaultPath, ticker, DEFAULT_HORIZON);
  if (!fs.existsSync(legacy)) return;
  if (fs.existsSync(target)) return;
  try {
    fs.renameSync(legacy, target);
  } catch {
    // Non-fatal: leave legacy in place if rename fails.
  }
}

export function loadPredictions(
  vaultPath: string,
  ticker: string,
  horizon: number = DEFAULT_HORIZON
): TickerPrediction[] {
  migrateLegacyTickerFile(vaultPath, ticker);
  try {
    const raw = fs.readFileSync(predictionsFile(vaultPath, ticker, horizon), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePredictions(
  vaultPath: string,
  ticker: string,
  predictions: TickerPrediction[],
  horizon: number = DEFAULT_HORIZON
): void {
  const dir = predictionsDir(vaultPath);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = predictionsFile(vaultPath, ticker, horizon);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(predictions, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

export function appendPrediction(vaultPath: string, prediction: TickerPrediction): void {
  const horizon = prediction.horizonDays ?? DEFAULT_HORIZON;
  const existing = loadPredictions(vaultPath, prediction.ticker, horizon);
  existing.push(prediction);
  savePredictions(vaultPath, prediction.ticker, existing, horizon);
}

function derivePredictionCatalystTypes(prediction: TickerPrediction): CatalystType[] {
  if (prediction.catalystTypes && prediction.catalystTypes.length > 0) {
    return [...new Set(prediction.catalystTypes)];
  }

  const derived = prediction.catalysts.flatMap((catalyst) => {
    if (catalyst.catalystTypes && catalyst.catalystTypes.length > 0) {
      return catalyst.catalystTypes;
    }
    return classifyCatalystTypes({
      headline: catalyst.headline,
      verdict: catalyst.verdict,
    });
  });

  if (derived.length === 0) return ["other"];
  return [...new Set(derived)];
}

export function computePredictionOutcome(
  direction: TickerPrediction["direction"],
  magnitudePct: number,
  actualPct: number
): PredictionOutcome {
  const absActual = Math.abs(actualPct);
  let effectiveDirection: TickerPrediction["direction"];
  if (absActual <= FLAT_BAND_PCT) {
    effectiveDirection = "FLAT";
  } else {
    effectiveDirection = actualPct > 0 ? "UP" : "DOWN";
  }

  if (effectiveDirection !== direction) return "INCORRECT";
  if (absActual >= magnitudePct * CORRECT_DIRECTION_MAGNITUDE_RATIO) return "CORRECT";
  return "PARTIAL";
}

export function resolveEligiblePredictions(
  vaultPath: string,
  ticker: string,
  currentPrice: number | null,
  nowMs: number,
  horizon?: number
): { resolved: number } {
  if (currentPrice === null) return { resolved: 0 };

  const horizons: number[] = horizon ? [horizon] : [...SUPPORTED_HORIZONS];
  let resolved = 0;

  for (const h of horizons) {
    const predictions = loadPredictions(vaultPath, ticker, h);
    if (predictions.length === 0) continue;

    let changed = false;
    const updated = predictions.map((p) => {
      if (p.status !== "pending") return p;
      const daysSince = Math.floor((nowMs - p.runAt) / 86_400_000);
      if (daysSince < p.horizonDays) return p;

      const actualPct =
        ((currentPrice - p.priceAtPrediction) / p.priceAtPrediction) * 100;
      const outcome = computePredictionOutcome(p.direction, p.magnitudePct, actualPct);
      const catalystTypes = derivePredictionCatalystTypes(p);
      changed = true;
      resolved++;

      return {
        ...p,
        catalystTypes,
        status: "resolved" as const,
        resolvedAt: nowMs,
        priceAtResolution: currentPrice,
        actualPct: Math.round(actualPct * 100) / 100,
        outcome,
      };
    });

    if (changed) savePredictions(vaultPath, ticker, updated, h);
  }
  return { resolved };
}

export function getRecentResolvedPredictions(
  vaultPath: string,
  ticker: string,
  limit = 3,
  horizon?: number
): TickerPrediction[] {
  const horizons: number[] = horizon ? [horizon] : [...SUPPORTED_HORIZONS];
  const all = horizons.flatMap((h) => loadPredictions(vaultPath, ticker, h));
  return all
    .filter((p) => p.status === "resolved")
    .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
    .slice(0, limit);
}

export function getPendingPrediction(
  vaultPath: string,
  ticker: string,
  horizon: number = DEFAULT_HORIZON
): TickerPrediction | null {
  const predictions = loadPredictions(vaultPath, ticker, horizon);
  return (
    predictions
      .filter((p) => p.status === "pending")
      .sort((a, b) => b.runAt - a.runAt)[0] ?? null
  );
}

export function getAllPredictions(
  vaultPath: string,
  limit = 50
): Record<string, TickerPrediction[]> {
  const dir = predictionsDir(vaultPath);
  try {
    // Migrate any unmigrated legacy files first so callers see a unified view.
    const all = fs.readdirSync(dir);
    for (const file of all) {
      const legacyMatch = file.match(/^([A-Z0-9.\-]+)\.json$/);
      if (!legacyMatch) continue;
      // Skip files that already match the horizon-suffixed shape.
      if (/-\d+d\.json$/.test(file)) continue;
      migrateLegacyTickerFile(vaultPath, legacyMatch[1]);
    }

    const horizonFiles = fs
      .readdirSync(dir)
      .filter((f) => /-\d+d\.json$/.test(f));

    const grouped = new Map<string, TickerPrediction[]>();
    for (const file of horizonFiles) {
      const m = file.match(/^([A-Z0-9.\-]+?)-(\d+)d\.json$/);
      if (!m) continue;
      const ticker = m[1];
      const horizon = parseInt(m[2], 10);
      const predictions = loadPredictions(vaultPath, ticker, horizon);
      const bucket = grouped.get(ticker) ?? [];
      bucket.push(...predictions);
      grouped.set(ticker, bucket);
    }

    const result: Record<string, TickerPrediction[]> = {};
    for (const [ticker, predictions] of grouped.entries()) {
      result[ticker] = predictions
        .sort((a, b) => b.runAt - a.runAt)
        .slice(0, limit);
    }
    return result;
  } catch {
    return {};
  }
}
