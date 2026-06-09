// Shared timescale definitions for PositionCard graphs.
// Kept in its own client-safe module (no Node imports) so the chart UI, the
// account settings panel, and the preferences API all validate against one list.

// Selectable x-axis windows, in trading-day points (~21 trading days / month).
export const TIMESCALE_WINDOWS = [
  { key: "1M", points: 21 },
  { key: "2M", points: 42 },
  { key: "3M", points: 63 },
  { key: "4M", points: 84 },
  { key: "5M", points: 105 },
  { key: "6M", points: 126 },
  { key: "1Y", points: 252 },
  { key: "2Y", points: 504 },
] as const;

export type TimescaleKey = (typeof TIMESCALE_WINDOWS)[number]["key"];

export const TIMESCALE_KEYS = TIMESCALE_WINDOWS.map((w) => w.key) as TimescaleKey[];

/** Fallback when a user has no saved preference. */
export const DEFAULT_TIMESCALE: TimescaleKey = "6M";

export function isTimescaleKey(v: unknown): v is TimescaleKey {
  return typeof v === "string" && (TIMESCALE_KEYS as string[]).includes(v);
}

/** Index of a timescale key in TIMESCALE_WINDOWS, or the default's index. */
export function timescaleIndex(key: string | null | undefined): number {
  const i = TIMESCALE_WINDOWS.findIndex((w) => w.key === key);
  return i >= 0 ? i : TIMESCALE_WINDOWS.findIndex((w) => w.key === DEFAULT_TIMESCALE);
}
