import type { VaultStore } from "../lib/vault/store";
import { debug } from "../lib/debug";
import { classifyCatalystTypes } from "./catalyst-classifier";
import type {
  CatalystType,
  TickerPrediction,
  PredictionOutcome,
} from "../types/predictions";
import { FLAT_BAND_PCT, CORRECT_DIRECTION_MAGNITUDE_RATIO } from "../types/predictions";
import type { DailyBar } from "../lib/marketdata/prices";
import { findBarOnOrAfter, flatBandFromBars } from "../lib/marketdata/volatility";

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
  actualPct: number,
  flatBandPct: number = FLAT_BAND_PCT
): PredictionOutcome {
  const absActual = Math.abs(actualPct);
  let effectiveDirection: TickerPrediction["direction"];
  if (absActual <= flatBandPct) {
    effectiveDirection = "FLAT";
  } else {
    effectiveDirection = actualPct > 0 ? "UP" : "DOWN";
  }

  if (effectiveDirection !== direction) return "INCORRECT";
  if (absActual >= magnitudePct * CORRECT_DIRECTION_MAGNITUDE_RATIO) return "CORRECT";
  return "PARTIAL";
}

function dateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A pending prediction this many days past its horizon with no resolvable
 *  price data is marked "expired" instead of sitting pending forever. */
const EXPIRY_GRACE_DAYS = 30;

export async function resolveEligiblePredictions(
  store: VaultStore,
  ticker: string,
  currentPrice: number | null,
  nowMs: number,
  horizon?: number,
  bars?: DailyBar[] | null
): Promise<{ resolved: number; expired: number }> {
  // With daily bars we resolve against the close at the horizon DATE (the true
  // 1d/7d/30d window) rather than the live price at whatever moment the resolver
  // happens to run — which previously scored a "1d" prediction resolved 5 days
  // late against a 5-day move. Without bars we fall back to the legacy live-price
  // path, which still requires a current price. With neither, this still runs an
  // expiry-only pass over long-overdue pendings.
  const hasBars = Array.isArray(bars) && bars.length > 0;

  const horizons: number[] = horizon ? [horizon] : [...SUPPORTED_HORIZONS];
  let resolved = 0;
  let expired = 0;

  for (const h of horizons) {
    const predictions = await loadPredictions(store, ticker, h);
    if (predictions.length === 0) continue;

    const pending = predictions.filter((p) => p.status === "pending");
    if (pending.length > 0) {
      const now = dateKey(nowMs);
      const pendingAges = pending.map((p) => ({
        id: p.id,
        daysSince: Math.floor((nowMs - p.runAt) / 86_400_000),
        horizon: p.horizonDays,
      }));
      debug(
        "predictions",
        `${ticker}: ${pending.length} pending prediction(s), ages:`,
        pendingAges.map((p) => `${p.daysSince}d/${p.horizon}d`).join(", "),
        `as of ${now}`
      );
    }

    let changed = false;
    const updated = predictions.map((p) => {
      if (p.status !== "pending") return p;
      const daysSince = Math.floor((nowMs - p.runAt) / 86_400_000);
      if (daysSince < p.horizonDays) return p;
      // No outcome, no calibration impact — just removed from the pending pool.
      const expire = () => {
        changed = true;
        expired++;
        debug("predictions", `Expired ${p.id}: ${daysSince}d old with no resolvable price data`);
        return { ...p, status: "expired" as const, resolvedAt: nowMs };
      };
      const pastGrace = daysSince > p.horizonDays + EXPIRY_GRACE_DAYS;

      // Resolution price + the date it actually corresponds to.
      let resolutionPrice: number;
      let resolvedAtMs: number;
      let band: number;

      if (hasBars) {
        const targetDate = dateKey(p.runAt + p.horizonDays * 86_400_000);
        const resolutionBar = findBarOnOrAfter(bars!, targetDate);
        // Horizon date has no bar yet (future / data lag) — keep pending unless
        // it is so far past the horizon that data is clearly never arriving.
        if (!resolutionBar) return pastGrace ? expire() : p;
        resolutionPrice = resolutionBar.close;
        resolvedAtMs = Date.parse(`${resolutionBar.date}T16:00:00.000Z`) || nowMs;
        band = flatBandFromBars(bars!, dateKey(p.runAt), p.horizonDays);
      } else if (currentPrice !== null) {
        resolutionPrice = currentPrice;
        resolvedAtMs = nowMs;
        band = FLAT_BAND_PCT;
      } else {
        return pastGrace ? expire() : p;
      }

      const actualPct =
        ((resolutionPrice - p.priceAtPrediction) / p.priceAtPrediction) * 100;
      const outcome = computePredictionOutcome(p.direction, p.magnitudePct, actualPct, band);
      const catalystTypes = derivePredictionCatalystTypes(p);
      changed = true;
      resolved++;

      debug(
        "predictions",
        `Resolved ${p.id}: ${p.direction} → ${outcome} (predicted ${p.magnitudePct}%, actual ${actualPct.toFixed(2)}%, band ±${band.toFixed(2)}%)`
      );

      return {
        ...p,
        catalystTypes,
        status: "resolved" as const,
        resolvedAt: resolvedAtMs,
        priceAtResolution: Math.round(resolutionPrice * 100) / 100,
        actualPct: Math.round(actualPct * 100) / 100,
        outcome,
        flatBandPct: Math.round(band * 100) / 100,
      };
    });

    if (changed) await savePredictions(store, ticker, updated, h);
  }
  return { resolved, expired };
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