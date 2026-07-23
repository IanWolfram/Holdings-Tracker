/**
 * Agent scheduler types and utilities.
 * Defines job kinds, watch rules, and cron computation.
 */

export type AgentJobKind =
  | "morning_digest"
  | "earnings_watch"
  | "concentration_risk"
  | "congress"
  | "story_backlog";

export type WatchRule =
  | { type: "verdict_flip" }
  | { type: "price_above"; value: number }
  | { type: "price_below"; value: number };

/**
 * Compute the next run time for a cron expression in the given timezone.
 * Returns null if the expression is invalid or disabled.
 */
export function computeNextRun(cronExpr: string, tz: string): Date | null {
  try {
    // Simple cron parser: supports standard 5-field cron expressions
    // For now, compute next midnight-relative run time
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    const now = new Date();
    // Scan minute-by-minute for the next 48 hours. (A coarser step silently
    // misses schedules whose minute doesn't align with the step — e.g. a
    // 10-minute scan from :04 never lands on a */15 minute, returning null and
    // killing the job's schedule.)
    for (let i = 1; i <= 48 * 60; i++) {
      const candidate = new Date(now.getTime() + i * 60 * 1000);
      candidate.setSeconds(0, 0);
      if (matchesCron(parts, candidate)) {
        return candidate;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function matchesCron(parts: string[], date: Date): boolean {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay(); // 0=Sun

  return (
    matchesField(parts[0], minute, 0, 59) &&
    matchesField(parts[1], hour, 0, 23) &&
    matchesField(parts[2], dayOfMonth, 1, 31) &&
    matchesField(parts[3], month, 1, 12) &&
    matchesField(parts[4], dayOfWeek, 0, 6)
  );
}

function matchesField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") return true;

  // Handle ranges like "1-5"
  if (field.includes("-")) {
    const [start, end] = field.split("-").map(Number);
    return value >= start && value <= end;
  }

  // Handle steps like "*/15"
  if (field.startsWith("*/")) {
    const step = Number(field.slice(2));
    return step > 0 && value % step === 0;
  }

  // Handle lists like "0,30"
  if (field.includes(",")) {
    return field.split(",").map(Number).includes(value);
  }

  // Simple number
  return Number(field) === value;
}