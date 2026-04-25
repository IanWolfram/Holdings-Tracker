import fs from "fs";
import path from "path";
import { resolveVaultPath } from "../lib/constants";
import type { TickerPrediction, PredictionOutcome } from "../types/predictions";
import { FLAT_BAND_PCT, CORRECT_DIRECTION_MAGNITUDE_RATIO } from "../types/predictions";

function predictionsDir(vaultPath: string): string {
  const resolved = resolveVaultPath(vaultPath) ?? vaultPath;
  return path.join(resolved, "predictions");
}

function predictionsFile(vaultPath: string, ticker: string): string {
  return path.join(predictionsDir(vaultPath), `${ticker}.json`);
}

export function loadPredictions(vaultPath: string, ticker: string): TickerPrediction[] {
  try {
    const raw = fs.readFileSync(predictionsFile(vaultPath, ticker), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePredictions(
  vaultPath: string,
  ticker: string,
  predictions: TickerPrediction[]
): void {
  const dir = predictionsDir(vaultPath);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = predictionsFile(vaultPath, ticker);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(predictions, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

export function appendPrediction(vaultPath: string, prediction: TickerPrediction): void {
  const existing = loadPredictions(vaultPath, prediction.ticker);
  existing.push(prediction);
  savePredictions(vaultPath, prediction.ticker, existing);
}

function computeOutcome(
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
  nowMs: number
): { resolved: number } {
  if (currentPrice === null) return { resolved: 0 };

  const predictions = loadPredictions(vaultPath, ticker);
  let resolved = 0;

  const updated = predictions.map((p) => {
    if (p.status !== "pending") return p;
    const daysSince = Math.floor((nowMs - p.runAt) / 86_400_000);
    if (daysSince < p.horizonDays) return p;

    const actualPct =
      ((currentPrice - p.priceAtPrediction) / p.priceAtPrediction) * 100;
    const outcome = computeOutcome(p.direction, p.magnitudePct, actualPct);
    resolved++;

    return {
      ...p,
      status: "resolved" as const,
      resolvedAt: nowMs,
      priceAtResolution: currentPrice,
      actualPct: Math.round(actualPct * 100) / 100,
      outcome,
    };
  });

  if (resolved > 0) savePredictions(vaultPath, ticker, updated);
  return { resolved };
}

export function getRecentResolvedPredictions(
  vaultPath: string,
  ticker: string,
  limit = 3
): TickerPrediction[] {
  const predictions = loadPredictions(vaultPath, ticker);
  return predictions
    .filter((p) => p.status === "resolved")
    .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
    .slice(0, limit);
}

export function getPendingPrediction(
  vaultPath: string,
  ticker: string
): TickerPrediction | null {
  const predictions = loadPredictions(vaultPath, ticker);
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
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    const result: Record<string, TickerPrediction[]> = {};
    for (const file of files) {
      const ticker = file.replace(".json", "");
      const predictions = loadPredictions(vaultPath, ticker);
      result[ticker] = predictions
        .sort((a, b) => b.runAt - a.runAt)
        .slice(0, limit);
    }
    return result;
  } catch {
    return {};
  }
}
