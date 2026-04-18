/**
 * Lightweight NYSE market-hours helper.
 *
 * Returns one of: "open" | "pre" | "post" | "closed" (weekend/holiday)
 * plus a formatted countdown to the next state change.
 *
 * Notes:
 * - Uses Intl to compute the current time in America/New_York.
 * - Does NOT account for holidays — fine for a client-side UI hint.
 *   If you need holiday accuracy, add a hard-coded holiday list or
 *   proxy through a server route that calls a calendar.
 */

export type MarketState = "open" | "pre" | "post" | "closed";

export interface MarketStatus {
  state: MarketState;
  /** Countdown to next transition, formatted "2h 18m" or "42m" */
  countdown: string;
  /** Verb for the countdown: "opens" | "closes" */
  verb: "opens" | "closes";
}

const OPEN_HOUR = 9;
const OPEN_MIN = 30;
const CLOSE_HOUR = 16;
const PRE_OPEN_HOUR = 4;
const POST_CLOSE_HOUR = 20;

/**
 * Returns { y, m, d, h, min, weekday (0=Sun) } for the given Date in NY time.
 */
function nyParts(now: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    y: Number(parts.year),
    mo: Number(parts.month),
    d: Number(parts.day),
    h: Number(parts.hour === "24" ? "0" : parts.hour),
    min: Number(parts.minute),
    weekday: weekdays.indexOf(parts.weekday as string),
  };
}

function minutesFromMidnight(h: number, m: number) {
  return h * 60 + m;
}

function formatCountdown(totalMin: number): string {
  if (totalMin < 0) totalMin = 0;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const p = nyParts(now);
  const nowMin = minutesFromMidnight(p.h, p.min);
  const openMin = minutesFromMidnight(OPEN_HOUR, OPEN_MIN);
  const closeMin = minutesFromMidnight(CLOSE_HOUR, 0);
  const preOpenMin = minutesFromMidnight(PRE_OPEN_HOUR, 0);
  const postCloseMin = minutesFromMidnight(POST_CLOSE_HOUR, 0);
  const isWeekend = p.weekday === 0 || p.weekday === 6;

  if (isWeekend) {
    // Minutes until Monday 9:30 local NY time
    const daysUntilMon = p.weekday === 6 ? 2 : 1;
    const minsToday = 24 * 60 - nowMin;
    const minsToMon = minsToday + (daysUntilMon - 1) * 24 * 60 + openMin;
    return { state: "closed", countdown: formatCountdown(minsToMon), verb: "opens" };
  }

  if (nowMin >= openMin && nowMin < closeMin) {
    return { state: "open", countdown: formatCountdown(closeMin - nowMin), verb: "closes" };
  }
  if (nowMin >= preOpenMin && nowMin < openMin) {
    return { state: "pre", countdown: formatCountdown(openMin - nowMin), verb: "opens" };
  }
  if (nowMin >= closeMin && nowMin < postCloseMin) {
    return { state: "post", countdown: formatCountdown(postCloseMin - nowMin), verb: "closes" };
  }

  // Overnight closed — minutes until next 9:30 (could be tomorrow or Monday if Fri night)
  const minsToTomorrowOpen =
    (24 * 60 - nowMin) + openMin + (p.weekday === 5 ? 2 * 24 * 60 : 0);
  return { state: "closed", countdown: formatCountdown(minsToTomorrowOpen), verb: "opens" };
}

export const MARKET_STATE_LABEL: Record<MarketState, string> = {
  open: "NYSE OPEN",
  pre: "PRE-MARKET",
  post: "AFTER HOURS",
  closed: "CLOSED",
};

export const MARKET_STATE_DOT: Record<MarketState, string> = {
  open: "bg-positive",          // #00FF88
  pre: "bg-yellow-400",
  post: "bg-orange-400",
  closed: "bg-slate-500",
};
