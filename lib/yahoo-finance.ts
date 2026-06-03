/**
 * Yahoo Finance chart API — used for 90-day price history only.
 * Uses the v8 chart endpoint with crumb authentication.
 */

import type { HistoryData } from "@/types/market-data.types";
import { YAHOO_HEADERS } from "./constants";

let crumbCache: { crumb: string; cookie: string; expiresAt: number } | null =
  null;
let crumbInflight: Promise<{ crumb: string; cookie: string }> | null = null;
const CRUMB_TTL_MS = 60 * 60 * 1000;
const CRUMB_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;
let crumbRateLimitedUntil = 0;

function makeCrumbRateLimitedError(sourceStatus?: number): Error {
  const err = new Error(
    sourceStatus
      ? `Yahoo crumb rate-limited (HTTP ${sourceStatus})`
      : "Yahoo crumb rate-limited"
  );
  err.name = "YahooCrumbRateLimitError";
  return err;
}

export function isYahooCrumbRateLimitedError(err: unknown): boolean {
  return err instanceof Error && err.name === "YahooCrumbRateLimitError";
}

async function fetchCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (Date.now() < crumbRateLimitedUntil) {
    throw makeCrumbRateLimitedError();
  }

  const consentRes = await fetch("https://finance.yahoo.com/", {
    headers: { ...YAHOO_HEADERS, Accept: "text/html" },
    redirect: "follow",
  });

  if (consentRes.status === 429) {
    crumbRateLimitedUntil = Date.now() + CRUMB_RATE_LIMIT_COOLDOWN_MS;
    throw makeCrumbRateLimitedError(429);
  }

  const rawCookies =
    (consentRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const cookieStr = rawCookies.map((c: string) => c.split(";")[0]).join("; ");

  const crumbRes = await fetch(
    "https://query2.finance.yahoo.com/v1/test/getcrumb",
    { headers: { ...YAHOO_HEADERS, Cookie: cookieStr, Accept: "text/plain" } }
  );

  if (crumbRes.status === 429) {
    crumbRateLimitedUntil = Date.now() + CRUMB_RATE_LIMIT_COOLDOWN_MS;
    throw makeCrumbRateLimitedError(429);
  }

  if (!crumbRes.ok) {
    throw new Error(
      `Failed to get Yahoo Finance crumb: HTTP ${crumbRes.status}`
    );
  }

  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb === "null" || crumb.startsWith("{")) {
    throw new Error("Yahoo Finance returned an invalid crumb");
  }

  crumbCache = {
    crumb,
    cookie: cookieStr,
    expiresAt: Date.now() + CRUMB_TTL_MS,
  };
  return crumbCache;
}

async function getCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (crumbCache && crumbCache.expiresAt > Date.now()) {
    return crumbCache;
  }

  if (!crumbInflight) {
    crumbInflight = fetchCrumb().finally(() => {
      crumbInflight = null;
    });
  }

  return crumbInflight;
}

export async function fetchYahooHistory(
  ticker: string,
  days = 520
): Promise<HistoryData> {
  const { crumb, cookie } = await getCrumb();

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2y&crumb=${encodeURIComponent(crumb)}`;
  let res = await fetch(url, {
    headers: { ...YAHOO_HEADERS, Cookie: cookie, Accept: "application/json" },
  });

  if (res.status === 401 || res.status === 403) {
    crumbCache = null;
    const { crumb: freshCrumb, cookie: freshCookie } = await getCrumb();
    const retryUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2y&crumb=${encodeURIComponent(freshCrumb)}`;
    res = await fetch(retryUrl, {
      headers: {
        ...YAHOO_HEADERS,
        Cookie: freshCookie,
        Accept: "application/json",
      },
    });
  }

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    res = await fetch(url, {
      headers: { ...YAHOO_HEADERS, Cookie: cookie, Accept: "application/json" },
    });
  }

  if (!res.ok) {
    throw new Error(
      `Yahoo Finance history unavailable for ${ticker}: HTTP ${res.status}`
    );
  }

  const json = (await res.json()) as {
    chart: {
      result: Array<{
        indicators: { quote: Array<{ close: (number | null)[] }> };
      }> | null;
      error: { code: string; description: string } | null;
    };
  };

  if (json.chart.error) {
    throw new Error(
      `Yahoo Finance error for ${ticker}: ${json.chart.error.description}`
    );
  }

  const result = json.chart.result?.[0];
  if (!result) {
    throw new Error(`No history data returned for ${ticker}`);
  }

  const raw = result.indicators.quote[0]?.close ?? [];
  const filtered = raw.filter(
    (v): v is number => v !== null && v !== undefined
  );

  if (filtered.length === 0) {
    throw new Error(`No history data for ${ticker} after filtering nulls`);
  }

  return {
    ticker,
    closes: filtered.slice(-days),
    source: "yahoo",
    fetchedAt: Date.now(),
  };
}
