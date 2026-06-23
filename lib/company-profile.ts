import { lookupCountry, lookupCountryByCode } from "./country-coords";
import { TICKER_COORDS } from "./ticker-coords";
import { resolveCoordinates } from "./geo-lookup";
import { FINNHUB_BASE_URL, API_TIMEOUT_MS } from "./constants";
import { enqueuePolygon } from "./polygon";
import type { CompanyProfile } from "@/types/geo.types";

// Static company data used as fallback when no API key is configured
const WORLD_PROFILES: Record<string, { name: string; ticker: string; countryCode: string }> = {
  "BR":     { name: "Broadridge Financial Solutions", ticker: "BR",     countryCode: "US" },
  "MSFT":   { name: "Microsoft Corporation",          ticker: "MSFT",   countryCode: "US" },
  "AAPL":   { name: "Apple Inc.",                     ticker: "AAPL",   countryCode: "US" },
  "NVDA":   { name: "NVIDIA Corporation",             ticker: "NVDA",   countryCode: "US" },
  "JPM":    { name: "JPMorgan Chase & Co.",           ticker: "JPM",    countryCode: "US" },
  "RBL":    { name: "Roblox Corporation",             ticker: "RBL",    countryCode: "US" },
  "TM":     { name: "Toyota Motor Corporation",       ticker: "TM",     countryCode: "JP" },
  "INFY":   { name: "Infosys Limited",                ticker: "INFY",   countryCode: "IN" },
  "005930": { name: "Samsung Electronics Co. Ltd",    ticker: "005930", countryCode: "KR" },
};

// ---------------------------------------------------------------------------
// 24-hour in-memory cache — company profiles barely change
// ---------------------------------------------------------------------------

const profileCache = new Map<string, { data: CompanyProfile; expiresAt: number }>();
const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Finnhub /stock/profile2 response shape
// ---------------------------------------------------------------------------

interface FinnhubProfile {
  name?: string;
  country?: string;
  finnhubIndustry?: string;
  gsector?: string;
  gind?: string;
  ggroup?: string;
}

interface PolygonTickerDetails {
  results?: {
    ticker: string;
    name: string;
    description?: string;
    address?: {
      address1?: string;
      city?: string;
      state?: string;
      postal_code?: string;
    };
    branding?: {
      logo_url?: string;
      icon_url?: string;
    };
    sic_description?: string;
  };
  status: string;
}

// ---------------------------------------------------------------------------
// Automated Cache — stores the results of Polygon + GeoLookup to prevent
// redundant API calls. Persists for 7 days.
// ---------------------------------------------------------------------------

const automatedProfileCache = new Map<string, { data: CompanyProfile; expiresAt: number }>();
const AUTOMATED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @param resolveHqCoords  When true, fall back to a Polygon lookup to discover
 *   precise HQ coordinates for tickers missing from TICKER_COORDS. This is
 *   GLOBE-only enrichment and goes through Polygon's shared rate-limit queue,
 *   so callers that only need the company name (positions, news) must leave it
 *   false to keep Polygon off their hot path.
 */
export async function fetchCompanyProfile(
  ticker: string,
  { resolveHqCoords = false }: { resolveHqCoords?: boolean } = {}
): Promise<CompanyProfile | null> {
  const cached = profileCache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    console.warn("[company-profile] FINNHUB_API_KEY not set — using static fallback for", ticker);
    return fallbackProfile(ticker);
  }

  const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${key}`;

  let raw: FinnhubProfile;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[company-profile] Finnhub error ${res.status} for ${ticker} — using static fallback`);
      return fallbackProfile(ticker);
    }
    raw = (await res.json()) as FinnhubProfile;
  } catch (err) {
    console.warn(`[company-profile] Fetch failed for ${ticker} — using static fallback:`, err);
    return fallbackProfile(ticker);
  }

  if (!raw.country) {
    console.warn(`[company-profile] No country from Finnhub for ${ticker} — using static fallback`);
    return fallbackProfile(ticker);
  }

  // Finnhub sometimes returns an ISO alpha-2 code ("US") instead of the
  // full country name ("United States"). Try name first, then code fallback.
  let coords = lookupCountry(raw.country);
  let resolvedCountry = raw.country;
  if (!coords) {
    const fullName = lookupCountryByCode(raw.country);
    if (fullName) {
      coords = lookupCountry(fullName);
      resolvedCountry = fullName;
    }
  }

  if (!coords) {
    console.warn(`[company-profile] No coords for country "${raw.country}" (${ticker}) — using static fallback`);
    return fallbackProfile(ticker);
  }

  // --- Precision HQ Discovery ---
  // Use company-specific HQ coords when available (more precise than country centroid)
  let hqCoords = TICKER_COORDS[ticker];

  // If missing from TickerCoords, try automated lookup via Polygon.io + Local Geo DB.
  // Skipped unless the caller explicitly wants HQ coords (globe only) — the
  // Polygon call goes through the shared rate-limit queue and must never block
  // the positions/news hot paths, which only need the company name.
  if (!hqCoords && resolveHqCoords) {
    const polyKey = process.env.POLYGON_API_KEY;
    const cachedAuto = automatedProfileCache.get(ticker);

    if (cachedAuto && Date.now() < cachedAuto.expiresAt) {
      hqCoords = { lat: cachedAuto.data.lat, lon: cachedAuto.data.lon };
    } else if (polyKey) {
      try {
        const polyUrl = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${polyKey}`;
        const polyRes = await enqueuePolygon(() =>
          fetch(polyUrl, { signal: AbortSignal.timeout(API_TIMEOUT_MS) })
        );
        if (polyRes.ok) {
          const polyData = (await polyRes.json()) as PolygonTickerDetails;
          const address = polyData.results?.address;
          if (address?.city) {
            const resolved = resolveCoordinates(address.city, address.state, resolvedCountry);
            if (resolved) {
              hqCoords = resolved;
              // We'll update the main profile with these coords below
            }
          }
        }
      } catch (err) {
        console.warn(`[company-profile] Polygon automated lookup failed for ${ticker}:`, err);
      }
    }
  }

  const sectorRaw = raw.gsector ?? raw.finnhubIndustry ?? "Unknown";
  const profile: CompanyProfile = {
    ticker,
    name: raw.name ?? ticker,
    country: resolvedCountry,
    countryCode: coords.code,
    sector: sectorRaw.replace("Technology", "Tech"),
    industry: raw.gind ?? raw.ggroup ?? raw.finnhubIndustry ?? "Unknown",
    lat: hqCoords?.lat ?? coords.lat,
    lon: hqCoords?.lon ?? coords.lon,
  };

  profileCache.set(ticker, { data: profile, expiresAt: Date.now() + PROFILE_TTL_MS });
  
  // If we found new precision coords via Polygon, cache them in the automated bucket
  if (hqCoords && !TICKER_COORDS[ticker]) {
    automatedProfileCache.set(ticker, { data: profile, expiresAt: Date.now() + AUTOMATED_TTL_MS });
  }

  return profile;
}

function fallbackProfile(ticker: string): CompanyProfile | null {
  const wp = WORLD_PROFILES[ticker];
  const tc = TICKER_COORDS[ticker];

  if (wp) {
    const countryName = lookupCountryByCode(wp.countryCode) ?? wp.countryCode;
    const countryCoords = lookupCountry(countryName);
    return {
      ticker,
      name: wp.name,
      country: countryName,
      countryCode: wp.countryCode,
      sector: "Unknown",
      industry: "Unknown",
      lat: tc?.lat ?? countryCoords?.lat ?? 0,
      lon: tc?.lon ?? countryCoords?.lon ?? 0,
    };
  }

  if (tc) {
    // Ticker has known HQ coords but no WORLD_PROFILES entry — assume US
    return {
      ticker,
      name: ticker,
      country: "United States",
      countryCode: "US",
      sector: "Unknown",
      industry: "Unknown",
      lat: tc.lat,
      lon: tc.lon,
    };
  }

  return null;
}
