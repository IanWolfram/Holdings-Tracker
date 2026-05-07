import type { VaultStore } from "../lib/vault/store";
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

function predictionPath(ticker: string, horizon: number): string {
  return `predictions/${ticker}-${horizon}d.json`;
}

export async function loadPredictions(
  store: VaultStore,
  ticker: string,
  horizon: number = DEFAULT_HORIZON
): Promise<TickerPrediction[]> {
  try {
    const content = await store.read(predictionPath(ticker, horizon));
    if (content === null) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePredictions(
  store: VaultStore,
  ticker: string,
  predictions: TickerPrediction[],
  horizon: number = DEFAULT_HORIZON
): Promise<void> {
  await store.write(predictionPath(ticker, horizon), JSON.stringify(predictions, null, 2));
}

export async function appendPrediction(store: VaultStore, prediction: TickerPrediction): Promise<void> {
  const horizon = prediction.horizonDays ?? DEFAULT_HORIZON;
  const existing = await loadPredictions(store, prediction.ticker, horizon);
  existing.push(prediction);
  await savePredictions(store, prediction.ticker, existing, horizon);
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

export async function resolveEligiblePredictions(
  store: VaultStore,
  ticker: string,
  currentPrice: number | null,
  nowMs: number,
  horizon?: number
): Promise<{ resolved: number }> {
  if (currentPrice === null) return { resolved: 0 };

  const horizons: number[] = horizon ? [horizon] : [...SUPPORTED_HORIZONS];
  let resolved = 0;

  for (const h of horizons) {
    const predictions = await loadPredictions(store, ticker, h);
    if (predictions.length === 0) continue;

    const pending = predictions.filter((p) => p.status === "pending");
    if (pending.length > 0) {
      const now = new Date(nowMs).toISOString().split("T")[0];
      const pendingAges = pending.map((p) => ({
        id: p.id,
        daysSince: Math.floor((nowMs - p.runAt) / 86_400_000),
        horizon: p.horizonDays,
      }));
      console.log(
        `[predictions] ${ticker}: ${pending.length} pending prediction(s), ages:`,
        pendingAges.map((p) => `${p.daysSince}d/${p.horizon}d`).join(", "),
        `as of ${now}`
      );
    }

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

      console.log(
        `[predictions] Resolved ${p.id}: ${p.direction} → ${outcome} (predicted ${p.magnitudePct}%, actual ${actualPct.toFixed(2)}%)`
      );

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

    if (changed) await savePredictions(store, ticker, updated, h);
  }
  return { resolved };
}

export async function getRecentResolvedPredictions(
  store: VaultStore,
  ticker: string,
  limit = 3,
  horizon?: number
): Promise<TickerPrediction[]> {
  const horizons: number[] = horizon ? [horizon] : [...SUPPORTED_HORIZONS];
  const all = (
    await Promise.all(horizons.map((h) => loadPredictions(store, ticker, h)))
  ).flat();
  return all
    .filter((p) => p.status === "resolved")
    .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))
    .slice(0, limit);
}

export async function getPendingPrediction(
  store: VaultStore,
  ticker: string,
  horizon: number = DEFAULT_HORIZON
): Promise<TickerPrediction | null> {
  const predictions = await loadPredictions(store, ticker, horizon);
  return (
    predictions
      .filter((p) => p.status === "pending")
      .sort((a, b) => b.runAt - a.runAt)[0] ?? null
  );
}

export async function getAllPredictions(
  store: VaultStore,
  limit = 50
): Promise<Record<string, TickerPrediction[]>> {
  try {
    const notes = await store.listNotes("predictions/");

    const grouped = new Map<string, TickerPrediction[]>();
    for (const note of notes) {
      // Match files like "predictions/TICKER-HORIZONd.json"
      const m = note.path.match(/^predictions\/([A-Z0-9.\-]+?)-(\d+)d\.json$/);
      if (!m) continue;
      const ticker = m[1];
      const horizon = parseInt(m[2], 10);
      const predictions = await loadPredictions(store, ticker, horizon);
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