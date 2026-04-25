/**
 * E*Trade OAuth 1.0a client
 *
 * ONE-TIME SETUP:
 * 1. Run `npm run etrade:auth` (or call getRequestToken + getAccessToken manually)
 * 2. Visit the authorization URL printed to the console
 * 3. Enter the verifier code shown after authorizing
 * 4. Copy the returned ETRADE_OAUTH_TOKEN and ETRADE_OAUTH_TOKEN_SECRET into .env.local
 *
 * Note: E*Trade access tokens expire daily at midnight ET on weekdays.
 * Re-run the auth flow each morning if you see 401 errors.
 */

import OAuth from "oauth-1.0a";
import crypto from "crypto";
import {
  NEWS_CACHE_TTL_MS,
  ACCOUNT_CACHE_TTL_MS,
  ETRADE_BASE_URL,
  ETRADE_AUTH_BASE_URL,
} from "./constants";
import type { Position } from "@/types/position.types";
export { MOCK_POSITIONS } from "./position-list";
import { MOCK_POSITIONS } from "./position-list";
function buildOAuth(): OAuth {
  return new OAuth({
    consumer: {
      key: process.env.ETRADE_CONSUMER_KEY ?? "",
      secret: process.env.ETRADE_CONSUMER_SECRET ?? "",
    },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return crypto.createHmac("sha1", key).update(baseString).digest("base64");
    },
  });
}

function accessToken(): OAuth.Token {
  return {
    key: process.env.ETRADE_OAUTH_TOKEN ?? "",
    secret: process.env.ETRADE_OAUTH_TOKEN_SECRET ?? "",
  };
}

/** oauth-1.0a includes realm="" by default; E*Trade rejects that field entirely. */
function toHeader(oauth: OAuth, data: OAuth.Authorization): { Authorization: string } {
  const header = oauth.toHeader(data);
  // Strip 'OAuth realm="", ' or 'OAuth realm="etrade.com", ' prefix variations
  header.Authorization = header.Authorization.replace(/^OAuth realm="[^"]*",\s*/, "OAuth ");
  return header;
}

/** Step 1 of OAuth flow — get a request token */
export async function getRequestToken(callbackUrl?: string): Promise<{
  token: string;
  tokenSecret: string;
  authUrl: string;
}> {
  const oauth = buildOAuth();
  const url = `${ETRADE_AUTH_BASE_URL}/oauth/request_token`;
  const requestData = { url, method: "GET" };

  const headers = toHeader(oauth, oauth.authorize(requestData));
  const callback = callbackUrl ?? "oob";
  const res = await fetch(`${url}?oauth_callback=${encodeURIComponent(callback)}`, {
    headers: { ...headers, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request token failed ${res.status}: ${body}`);
  }

  const params = new URLSearchParams(await res.text());
  const token = params.get("oauth_token") ?? "";
  const tokenSecret = params.get("oauth_token_secret") ?? "";
  const authUrl = `https://us.etrade.com/e/t/etws/authorize?key=${process.env.ETRADE_CONSUMER_KEY}&token=${token}`;

  return { token, tokenSecret, authUrl };
}

/** Step 2 of OAuth flow — exchange verifier for access token */
export async function getAccessToken(
  requestToken: string,
  requestTokenSecret: string,
  verifier: string
): Promise<{ token: string; tokenSecret: string }> {
  const oauth = buildOAuth();
  const url = `${ETRADE_AUTH_BASE_URL}/oauth/access_token`;
  const requestData = { url, method: "GET" };
  const tokenObj: OAuth.Token = { key: requestToken, secret: requestTokenSecret };

  const authHeader = toHeader(oauth, oauth.authorize(requestData, tokenObj));

  const res = await fetch(`${url}?oauth_verifier=${verifier}`, {
    headers: { ...authHeader, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Access token failed ${res.status}: ${body}`);
  }

  const params = new URLSearchParams(await res.text());
  return {
    token: params.get("oauth_token") ?? "",
    tokenSecret: params.get("oauth_token_secret") ?? "",
  };
}

/** Fetch all accounts and return the first accountIdKey */
async function fetchAccountIdKey(): Promise<string> {
  const oauth = buildOAuth();
  const url = `${ETRADE_BASE_URL}/v1/accounts/list.json`;
  const requestData = { url, method: "GET" };
  const headers = toHeader(oauth, oauth.authorize(requestData, accessToken()));

  const res = await fetch(url, {
    headers: { ...headers, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Accounts list failed ${res.status}: ${body}`);
  }

  const json = await res.json();
  const accounts =
    json?.AccountListResponse?.Accounts?.Account ?? [];

  if (accounts.length === 0) {
    throw new Error("No E*Trade accounts found");
  }

  return accounts[0].accountIdKey as string;
}

/** Fetch positions from E*Trade for a given accountIdKey */
async function fetchPortfolio(accountIdKey: string): Promise<Position[]> {
  const oauth = buildOAuth();
  const url = `${ETRADE_BASE_URL}/v1/accounts/${accountIdKey}/portfolio.json`;
  const requestData = { url, method: "GET" };
  const headers = toHeader(oauth, oauth.authorize(requestData, accessToken()));

  const res = await fetch(url, {
    headers: { ...headers, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Portfolio fetch failed ${res.status}: ${body}`);
  }

  const json = await res.json();
  const portfolioResponse = json?.PortfolioResponse;
  const accountPortfolios = portfolioResponse?.AccountPortfolio ?? [];

  const positions: Position[] = [];

  for (const accountPortfolio of accountPortfolios) {
    const positionList = accountPortfolio?.Position ?? [];
    for (const pos of positionList) {
      const ticker: string = pos?.Product?.symbol ?? "UNKNOWN";
      const description: string = pos?.symbolDescription ?? ticker;
      const quantity: number = Number(pos?.quantity ?? 0);
      const marketValue: number = Number(pos?.marketValue ?? 0);
      const totalGain: number = Number(pos?.totalGain ?? 0);
      const pricePaid: number = Number(pos?.pricePaid ?? 0);
      const currentPrice: number = Number(pos?.Quick?.lastTrade ?? 0);

      positions.push({
        ticker,
        description,
        quantity,
        marketValue,
        gainLoss: totalGain,
        pricePaid,
        currentPrice,
      });
    }
  }

  return positions;
}

// Simple in-memory cache: accountIdKey + positions with 5-min TTL
const cache = new Map<string, { data: unknown; expiresAt: number }>();

function fromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttlMs = NEWS_CACHE_TTL_MS): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export interface ETradeTransaction {
  transactionId: string;
  transactionDate: number; // epoch ms
  transactionType: string; // "Bought", "Sold", "Dividend", etc.
  amount: number;
  ticker?: string;
  quantity?: number;
  price?: number;
  fee?: number;
}

/** Fetch all transactions for a date range, handling pagination */
export async function getTransactions(
  startDate: string, // MM-DD-YYYY
  endDate: string    // MM-DD-YYYY
): Promise<ETradeTransaction[]> {
  const CACHE_KEY = `transactions:${startDate}:${endDate}`;
  const cached = fromCache<ETradeTransaction[]>(CACHE_KEY);
  if (cached) return cached;

  let accountIdKey = fromCache<string>("accountIdKey");
  if (!accountIdKey) {
    accountIdKey = await fetchAccountIdKey();
    setCache("accountIdKey", accountIdKey, ACCOUNT_CACHE_TTL_MS);
  }

  const all: ETradeTransaction[] = [];
  let startAt = 0;
  const count = 50;

  while (true) {
    const oauth = buildOAuth();
    const url =
      `${ETRADE_BASE_URL}/v1/accounts/${accountIdKey}/transactions/list.json` +
      `?startDate=${startDate}&endDate=${endDate}&count=${count}&startAt=${startAt}`;
    const requestData = { url, method: "GET" };
    const headers = toHeader(oauth, oauth.authorize(requestData, accessToken()));

    const res = await fetch(url, {
      headers: { ...headers, Accept: "application/json" },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Transactions fetch failed ${res.status}: ${body}`);
    }

    const json = await res.json();
    const raw = json?.TransactionListResponse?.Transaction ?? [];
    const page: ETradeTransaction[] = (Array.isArray(raw) ? raw : [raw]).map(
      (t: Record<string, unknown>) => ({
        transactionId: String(t.transactionId ?? ""),
        transactionDate: Number(t.transactionDate ?? 0),
        transactionType: String(t.transactionType ?? ""),
        amount: Number(t.amount ?? 0),
        ticker: (t.brokerage as Record<string, unknown> | undefined)?.product
          ? String(((t.brokerage as Record<string, unknown>).product as Record<string, unknown>)?.symbol ?? "")
          : undefined,
        quantity: (t.brokerage as Record<string, unknown> | undefined)?.quantity
          ? Number((t.brokerage as Record<string, unknown>).quantity)
          : undefined,
        price: (t.brokerage as Record<string, unknown> | undefined)?.price
          ? Number((t.brokerage as Record<string, unknown>).price)
          : undefined,
        fee: (t.brokerage as Record<string, unknown> | undefined)?.fee
          ? Number((t.brokerage as Record<string, unknown>).fee)
          : undefined,
      })
    );

    all.push(...page);

    const totalCount = Number(json?.TransactionListResponse?.totalCount ?? 0);
    startAt += count;
    if (startAt >= totalCount || page.length < count) break;
  }

  setCache(CACHE_KEY, all, NEWS_CACHE_TTL_MS);
  return all;
}

/** Fetch cash balance (uninvested money) for the first account */
export async function getCashBalance(): Promise<number> {
  const CACHE_KEY = "cashBalance";
  const cached = fromCache<number>(CACHE_KEY);
  if (cached !== null) return cached;

  let accountIdKey = fromCache<string>("accountIdKey");
  if (!accountIdKey) {
    accountIdKey = await fetchAccountIdKey();
    setCache("accountIdKey", accountIdKey, ACCOUNT_CACHE_TTL_MS);
  }

  const oauth = buildOAuth();
  const url = `${ETRADE_BASE_URL}/v1/accounts/${accountIdKey}/balance.json?instType=BROKERAGE&realTimeNAV=true`;
  const requestData = { url, method: "GET" };
  const headers = toHeader(oauth, oauth.authorize(requestData, accessToken()));

  const res = await fetch(url, {
    headers: { ...headers, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Balance fetch failed ${res.status}: ${body}`);
  }

  const json = await res.json();
  const cash: number =
    json?.BalanceResponse?.Computed?.cashAvailableForInvestment ??
    json?.BalanceResponse?.Computed?.netCash ??
    0;

  setCache(CACHE_KEY, cash);
  return cash;
}

/** Main entry point — returns positions with 5-min caching */
export async function getPositions(): Promise<Position[]> {
  const CACHE_KEY = "positions";
  const cached = fromCache<Position[]>(CACHE_KEY);
  if (cached) return cached;

  // Determine accountIdKey (also cached separately for efficiency)
  let accountIdKey = fromCache<string>("accountIdKey");
  if (!accountIdKey) {
    accountIdKey = await fetchAccountIdKey();
    setCache("accountIdKey", accountIdKey, ACCOUNT_CACHE_TTL_MS);
  }

  const raw = await fetchPortfolio(accountIdKey);

  // Deduplicate by ticker — sandbox sometimes returns the same symbol multiple times
  const seen = new Set<string>();
  const positions = raw.filter((p) => {
    if (seen.has(p.ticker)) return false;
    seen.add(p.ticker);
    return true;
  });

  setCache(CACHE_KEY, positions);
  return positions;
}

// ---------------------------------------------------------------------------
// MOCK DATA — re-exported from lib/position-list (single source of truth)
// ---------------------------------------------------------------------------

/** Returns mock data or live data depending on ETRADE_ENV.
 *  Falls back to mock data automatically if OAuth tokens are not yet set. */
export async function getPositionsSafe(): Promise<Position[]> {
  let positions: Position[] = [];

  if (process.env.ETRADE_ENV === "mock") {
    positions = MOCK_POSITIONS;
  } else {
    const hasTokens =
      !!process.env.ETRADE_OAUTH_TOKEN && !!process.env.ETRADE_OAUTH_TOKEN_SECRET;
    if (!hasTokens) {
      console.warn(
        "[etrade] OAuth tokens not set — returning mock data. Run `npm run etrade:auth` to authorize."
      );
      positions = MOCK_POSITIONS;
    } else {
      try {
        return await getPositions();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const expired = msg.includes("401") || msg.includes("403");
        console.warn(
          expired
            ? "[etrade] OAuth tokens expired — run `npm run etrade:auth` to refresh. Returning mock data."
            : `[etrade] API error (${msg}) — returning mock data.`
        );
        positions = MOCK_POSITIONS;
      }
    }
  }

  return positions;
}

/** Update .env.local with new tokens */
export async function updateEtradeTokens(token: string, secret: string) {
  if (typeof window !== "undefined") {
    throw new Error("updateEtradeTokens can only be called on the server");
  }

  const fs = await import("fs");
  const path = await import("path");
  const envPath = path.resolve(process.cwd(), ".env.local");

  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  const update = (key: string, value: string) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trimEnd() + `\n${key}=${value}\n`;
    }
  };

  update("ETRADE_OAUTH_TOKEN", token);
  update("ETRADE_OAUTH_TOKEN_SECRET", secret);

  fs.writeFileSync(envPath, content);
}
