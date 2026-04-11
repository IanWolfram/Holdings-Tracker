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

export interface Position {
  ticker: string;
  quantity: number;
  marketValue: number;
  gainLoss: number;
  pricePaid: number;
  currentPrice: number;
}

const BASE_URL =
  process.env.ETRADE_ENV === "sandbox"
    ? "https://apisb.etrade.com"
    : "https://api.etrade.com";

const AUTH_BASE_URL =
  process.env.ETRADE_ENV === "sandbox"
    ? "https://apisb.etrade.com"
    : "https://etws.etrade.com";

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
export async function getRequestToken(): Promise<{
  token: string;
  tokenSecret: string;
  authUrl: string;
}> {
  const oauth = buildOAuth();
  const url = `${AUTH_BASE_URL}/oauth/request_token`;
  const requestData = { url, method: "GET" };

  const headers = toHeader(oauth, oauth.authorize(requestData));
  const res = await fetch(`${url}?oauth_callback=oob`, {
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
  const url = `${AUTH_BASE_URL}/oauth/access_token`;
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
  const url = `${BASE_URL}/v1/accounts/list.json`;
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
  const url = `${BASE_URL}/v1/accounts/${accountIdKey}/portfolio.json`;
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
      const ticker: string =
        pos?.symbolDescription ?? pos?.Product?.symbol ?? "UNKNOWN";
      const quantity: number = Number(pos?.quantity ?? 0);
      const marketValue: number = Number(pos?.marketValue ?? 0);
      const totalGain: number = Number(pos?.totalGain ?? 0);
      const pricePaid: number = Number(pos?.pricePaid ?? 0);
      const currentPrice: number = Number(pos?.Quick?.lastTrade ?? 0);

      positions.push({ ticker, quantity, marketValue, gainLoss: totalGain, pricePaid, currentPrice });
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

function setCache(key: string, data: unknown, ttlMs = 5 * 60 * 1000): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
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
    setCache("accountIdKey", accountIdKey, 60 * 60 * 1000); // 1 hour
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
// MOCK DATA — used when ETRADE_ENV=mock (for local dev without credentials)
// ---------------------------------------------------------------------------

export const MOCK_POSITIONS: Position[] = [
  { ticker: "AAPL", quantity: 50, marketValue: 9250.0, gainLoss: 1250.0, pricePaid: 160.0, currentPrice: 185.0 },
  { ticker: "NVDA", quantity: 10, marketValue: 9350.0, gainLoss: 3850.0, pricePaid: 550.0, currentPrice: 935.0 },
  { ticker: "TSLA", quantity: 20, marketValue: 4400.0, gainLoss: -600.0, pricePaid: 250.0, currentPrice: 220.0 },
  { ticker: "MSFT", quantity: 15, marketValue: 6375.0, gainLoss: 1125.0, pricePaid: 350.0, currentPrice: 425.0 },
];

/** Returns mock data or live data depending on ETRADE_ENV.
 *  Falls back to mock data automatically if OAuth tokens are not yet set. */
export async function getPositionsSafe(): Promise<Position[]> {
  if (process.env.ETRADE_ENV === "mock") {
    return MOCK_POSITIONS;
  }
  const hasTokens =
    !!process.env.ETRADE_OAUTH_TOKEN && !!process.env.ETRADE_OAUTH_TOKEN_SECRET;
  if (!hasTokens) {
    console.warn(
      "[etrade] OAuth tokens not set — returning mock data. Run `npm run etrade:auth` to authorize."
    );
    return MOCK_POSITIONS;
  }
  return getPositions();
}
