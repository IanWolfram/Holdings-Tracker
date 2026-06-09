// Shared config for the "analyzed news max age" preference — how old an
// AI-analyzed news card may be and still appear in a PositionCard's stack.
//
// Client-safe (no Node imports): used by the settings UI, the preferences API
// validator, and server-side filtering in pages/api/news.ts.

export const ANALYZED_AGE_OPTIONS = [3, 7, 14, 30] as const;

export type AnalyzedAgeDays = (typeof ANALYZED_AGE_OPTIONS)[number];

/** Preserves prior behavior (the old hardcoded 7-day news window). */
export const DEFAULT_ANALYZED_AGE_DAYS: AnalyzedAgeDays = 7;

/** Largest selectable window — the server caches this superset so any choice
 *  can be served by trimming at response time without a cache miss. */
export const MAX_ANALYZED_AGE_DAYS: AnalyzedAgeDays = Math.max(
  ...ANALYZED_AGE_OPTIONS,
) as AnalyzedAgeDays;

export function isAnalyzedAge(v: unknown): v is AnalyzedAgeDays {
  return typeof v === "number" && (ANALYZED_AGE_OPTIONS as readonly number[]).includes(v);
}

/** Clamp an arbitrary value to a valid option, falling back to the default. */
export function coerceAnalyzedAge(v: unknown): AnalyzedAgeDays {
  return isAnalyzedAge(v) ? v : DEFAULT_ANALYZED_AGE_DAYS;
}

/**
 * Drop AI-analyzed stories older than `days`, leaving pending / unanalyzed
 * provider stories untouched (they are always recent and drive "Run Agent").
 * Pure and side-effect free — gate on `isAnalyzed`, not provenance.
 */
export function filterByAnalyzedAge<T extends { isAnalyzed?: boolean; datetime: number }>(
  stories: T[],
  days: number,
): T[] {
  const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  return stories.filter((s) => !(s.isAnalyzed === true && s.datetime < cutoff));
}
