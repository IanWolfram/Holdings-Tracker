/**
 * Agent scheduler types and utilities.
 * Defines job kinds, watch rules, and cron computation.
 */

export type AgentJobKind =
  | "morning_digest"
  | "congress"
  | "story_backlog";

export type WatchRule =
  | { type: "verdict_flip" }
  | { type: "price_above"; value: number }
  | { type: "price_below"; value: number };

export type WatchRuleType = WatchRule["type"];

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
      if (matchesCron(parts, candidate, tz)) {
        return candidate;
      }
    }
    return null;
  } catch {
    return null;
  }
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Break an absolute instant into cron fields as they read on the wall clock of
 * `tz`. Cron expressions are wall-clock ("30 6 * * *" means 06:30 local), so a
 * schedule must be matched against the target zone's local time, not the
 * server's. Falls back to server-local getters if `tz` is unusable.
 */
function partsInZone(date: Date, tz: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      weekday: "short",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const p: Record<string, string> = {};
    for (const part of fmt.formatToParts(date)) {
      if (part.type !== "literal") p[part.type] = part.value;
    }
    // Intl renders midnight as "24" in some engines; normalize to 0.
    const hour = Number(p.hour) % 24;
    return {
      minute: Number(p.minute),
      hour,
      dayOfMonth: Number(p.day),
      month: Number(p.month),
      dayOfWeek: WEEKDAY_INDEX[p.weekday] ?? date.getDay(),
    };
  } catch {
    return {
      minute: date.getMinutes(),
      hour: date.getHours(),
      dayOfMonth: date.getDate(),
      month: date.getMonth() + 1,
      dayOfWeek: date.getDay(),
    };
  }
}

function matchesCron(parts: string[], date: Date, tz: string): boolean {
  const { minute, hour, dayOfMonth, month, dayOfWeek } = partsInZone(date, tz);

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