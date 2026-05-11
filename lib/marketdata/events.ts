import { FINNHUB_BASE_URL, API_TIMEOUT_MS } from "../constants";

export interface EarningsEvent {
  ticker: string;
  date: string;
  hour: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
}

export interface MacroEvent {
  type: "fomc" | "cpi" | "jobs";
  date: string;
  title: string;
}

export interface EventsSnapshot {
  asOf: string;
  date: string;
  earnings: EarningsEvent[];
  macroEvents: MacroEvent[];
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { data: EventsSnapshot; expiresAt: number }>();

const FED_MACRO_EVENTS_2026: MacroEvent[] = [
  { type: "fomc", date: "2026-01-28", title: "FOMC policy decision" },
  { type: "fomc", date: "2026-03-18", title: "FOMC policy decision" },
  { type: "fomc", date: "2026-04-29", title: "FOMC policy decision" },
  { type: "fomc", date: "2026-06-17", title: "FOMC policy decision" },
  { type: "fomc", date: "2026-07-29", title: "FOMC policy decision" },
  { type: "fomc", date: "2026-09-16", title: "FOMC policy decision" },
  { type: "fomc", date: "2026-11-04", title: "FOMC policy decision" },
  { type: "fomc", date: "2026-12-16", title: "FOMC policy decision" },
  { type: "cpi", date: "2026-01-14", title: "US CPI release" },
  { type: "cpi", date: "2026-02-11", title: "US CPI release" },
  { type: "cpi", date: "2026-03-11", title: "US CPI release" },
  { type: "cpi", date: "2026-04-10", title: "US CPI release" },
  { type: "cpi", date: "2026-05-13", title: "US CPI release" },
  { type: "cpi", date: "2026-06-10", title: "US CPI release" },
  { type: "cpi", date: "2026-07-15", title: "US CPI release" },
  { type: "cpi", date: "2026-08-12", title: "US CPI release" },
  { type: "cpi", date: "2026-09-11", title: "US CPI release" },
  { type: "cpi", date: "2026-10-14", title: "US CPI release" },
  { type: "cpi", date: "2026-11-12", title: "US CPI release" },
  { type: "cpi", date: "2026-12-10", title: "US CPI release" },
  { type: "jobs", date: "2026-01-09", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-02-06", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-03-06", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-04-03", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-05-08", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-06-05", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-07-02", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-08-07", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-09-04", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-10-02", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-11-06", title: "US Nonfarm Payrolls" },
  { type: "jobs", date: "2026-12-04", title: "US Nonfarm Payrolls" },
];

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function uniqSortedTickers(tickers: string[]): string[] {
  return [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))].sort();
}

function getFallbackMacroEvents(targetDate: string): MacroEvent[] {
  return FED_MACRO_EVENTS_2026.filter((event) => event.date === targetDate);
}

async function fetchFinnhubEarnings(
  tickers: string[],
  fromDate: string,
  toDate: string
): Promise<EarningsEvent[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || tickers.length === 0) return [];

  const url =
    `${FINNHUB_BASE_URL}/calendar/earnings` +
    `?from=${fromDate}&to=${toDate}&token=${apiKey}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Finnhub earnings HTTP ${res.status}`);
  }

  const tickerSet = new Set(tickers);
  const json = (await res.json()) as {
    earningsCalendar?: Array<{
      date?: string;
      symbol?: string;
      hour?: string;
      epsEstimate?: number;
      epsActual?: number;
    }>;
  };

  return (json.earningsCalendar ?? [])
    .filter((item) => {
      const symbol = item.symbol?.toUpperCase();
      return Boolean(symbol && tickerSet.has(symbol));
    })
    .map((item) => ({
      ticker: item.symbol!.toUpperCase(),
      date: item.date ?? fromDate,
      hour: item.hour ?? null,
      epsEstimate:
        typeof item.epsEstimate === "number" && Number.isFinite(item.epsEstimate)
          ? item.epsEstimate
          : null,
      epsActual:
        typeof item.epsActual === "number" && Number.isFinite(item.epsActual)
          ? item.epsActual
          : null,
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function getUpcomingEarnings(
  tickers: string[],
  forDate: Date = new Date(),
  lookaheadDays: number = 14
): Promise<Map<string, number>> {
  const normalized = uniqSortedTickers(tickers);
  if (normalized.length === 0) return new Map();

  const fromDate = dateKey(forDate);
  const toDate = dateKey(addDays(forDate, lookaheadDays));

  let earnings: EarningsEvent[] = [];
  try {
    earnings = await fetchFinnhubEarnings(normalized, fromDate, toDate);
  } catch (err) {
    console.warn("[events] Failed to fetch upcoming earnings:", (err as Error).message);
    return new Map();
  }

  const startMs = Date.parse(`${fromDate}T00:00:00Z`);
  const result = new Map<string, number>();
  for (const event of earnings) {
    const eventMs = Date.parse(`${event.date}T00:00:00Z`);
    if (!Number.isFinite(eventMs)) continue;
    const days = Math.round((eventMs - startMs) / 86_400_000);
    const existing = result.get(event.ticker);
    if (existing === undefined || days < existing) {
      result.set(event.ticker, days);
    }
  }
  return result;
}

export async function getEventsSnapshot(
  tickers: string[],
  forDate: Date = new Date()
): Promise<EventsSnapshot> {
  const normalizedTickers = uniqSortedTickers(tickers);
  const targetDate = dateKey(forDate);
  const cacheKey = `${targetDate}:${normalizedTickers.join(",")}`;
  const now = Date.now();

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  let earnings: EarningsEvent[] = [];
  try {
    earnings = await fetchFinnhubEarnings(normalizedTickers, targetDate, targetDate);
  } catch (err) {
    console.warn("[events] Failed to fetch earnings calendar:", (err as Error).message);
  }

  const snapshot: EventsSnapshot = {
    asOf: new Date().toISOString(),
    date: targetDate,
    earnings,
    macroEvents: getFallbackMacroEvents(targetDate),
  };

  cache.set(cacheKey, { data: snapshot, expiresAt: now + CACHE_TTL_MS });
  return snapshot;
}