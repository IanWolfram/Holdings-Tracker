import { computeAtr14, type DailyBar } from "./prices";
import { FLAT_BAND_PCT } from "../../types/predictions";

/**
 * Volatility-aware resolution helpers shared by the live resolver
 * (`world-brain/predictions.ts`) and the backfill/re-resolution scripts.
 *
 * The fixed ±1% FLAT band mislabels normal daily noise on high-beta names as a
 * directional miss (a 3% day on HOOD is noise, not a move). These helpers size
 * the band to the ticker's own realized volatility (ATR%) and the horizon, so a
 * move only counts as "directional" when it clears that ticker's noise floor.
 */

/** Multiplier on ATR%·√horizon. <1 keeps the band inside a one-ATR move. */
export const FLAT_BAND_ATR_MULTIPLIER = 0.75;
/** Never tighter than the legacy ±1% (protects low-vol large-caps). */
export const FLAT_BAND_FLOOR_PCT = FLAT_BAND_PCT;
/** Never wider than this — guards against bad ATR data inflating the band. */
export const FLAT_BAND_CEIL_PCT = 20;

/** Latest bar with date <= targetDate (e.g. the prediction-day close). */
export function findBarOnOrBefore(bars: DailyBar[], targetDate: string): DailyBar | null {
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i].date <= targetDate) return bars[i];
  }
  return null;
}

/** Earliest bar with date >= targetDate (e.g. the horizon-date close). */
export function findBarOnOrAfter(bars: DailyBar[], targetDate: string): DailyBar | null {
  for (const bar of bars) {
    if (bar.date >= targetDate) return bar;
  }
  return null;
}

/**
 * ATR(14) as a percent of price, measured as of `asOfDate` (inclusive) so old
 * predictions are scored with the volatility that prevailed when they were made,
 * not today's. Returns null if there isn't enough history before the date.
 */
export function atrPercentAsOf(bars: DailyBar[], asOfDate: string): number | null {
  const window = bars.filter((b) => b.date <= asOfDate);
  if (window.length < 15) return null;
  const atr = computeAtr14(window.slice(-80));
  const ref = window[window.length - 1]?.close;
  if (atr === null || !ref || ref <= 0) return null;
  return (atr / ref) * 100;
}

/**
 * The FLAT band (in percent) for a given realized volatility and horizon.
 * Scales the daily ATR% by √horizon (diffusion), clamped to [floor, ceil].
 * Falls back to the legacy fixed band when volatility is unknown.
 */
export function flatBandPct(atrPct: number | null, horizonDays: number): number {
  if (atrPct === null || !Number.isFinite(atrPct) || atrPct <= 0) {
    return FLAT_BAND_FLOOR_PCT;
  }
  const horizon = Math.max(1, horizonDays);
  const scaled = FLAT_BAND_ATR_MULTIPLIER * atrPct * Math.sqrt(horizon);
  return Math.min(FLAT_BAND_CEIL_PCT, Math.max(FLAT_BAND_FLOOR_PCT, scaled));
}

/** Convenience: derive the FLAT band directly from bars + prediction date + horizon. */
export function flatBandFromBars(
  bars: DailyBar[],
  predictionDate: string,
  horizonDays: number
): number {
  return flatBandPct(atrPercentAsOf(bars, predictionDate), horizonDays);
}
