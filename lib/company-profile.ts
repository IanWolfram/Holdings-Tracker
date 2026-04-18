import { lookupCountry, lookupCountryByCode } from "./country-coords";
import { WORLD_PROFILES } from "@/lib/position-list";
import type { CompanyProfile } from "@/types/geo.types";

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchCompanyProfile(
  ticker: string
): Promise<CompanyProfile | null> {
  const cached = profileCache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    console.warn("[company-profile] FINNHUB_API_KEY not set — using static fallback for", ticker);
    return fallbackProfile(ticker);
  }

  const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${key}`;

  let raw: FinnhubProfile;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
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

  const sectorRaw = raw.gsector ?? raw.finnhubIndustry ?? "Unknown";
  const profile: CompanyProfile = {
    ticker,
    name: raw.name ?? ticker,
    country: resolvedCountry,
    countryCode: coords.code,
    sector: sectorRaw.replace("Technology", "Tech"),
    industry: raw.gind ?? raw.ggroup ?? raw.finnhubIndustry ?? "Unknown",
    lat: coords.lat,
    lon: coords.lon,
  };

  profileCache.set(ticker, { data: profile, expiresAt: Date.now() + PROFILE_TTL_MS });
  return profile;
}

function fallbackProfile(ticker: string): CompanyProfile | null {
  const wp = WORLD_PROFILES[ticker];
  if (!wp) return null;
  return {
    ticker,
    name: wp.name,
    country: lookupCountryByCode(wp.countryCode) ?? wp.countryCode,
    countryCode: wp.countryCode,
    sector: "Unknown",
    industry: "Unknown",
    lat: wp.lat,
    lon: wp.lon,
  };
}
