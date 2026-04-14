import { lookupCountry } from "./country-coords";
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
    console.error("[company-profile] FINNHUB_API_KEY not set — skipping profile fetch");
    return null;
  }

  const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${key}`;

  let raw: FinnhubProfile;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[company-profile] Finnhub error ${res.status} for ${ticker}`);
      return null;
    }
    raw = (await res.json()) as FinnhubProfile;
  } catch (err) {
    console.error(`[company-profile] Fetch failed for ${ticker}:`, err);
    return null;
  }

  if (!raw.country) {
    console.error(`[company-profile] No country returned for ${ticker}`);
    return null;
  }

  const coords = lookupCountry(raw.country);
  if (!coords) {
    console.error(`[company-profile] No coords for country "${raw.country}" (${ticker}) — add to country-coords.ts`);
    return null;
  }

  const profile: CompanyProfile = {
    ticker,
    name: raw.name ?? ticker,
    country: raw.country,
    countryCode: coords.code,
    sector: raw.gsector ?? raw.finnhubIndustry ?? "Unknown",
    industry: raw.gind ?? raw.ggroup ?? raw.finnhubIndustry ?? "Unknown",
    lat: coords.lat,
    lon: coords.lon,
  };

  profileCache.set(ticker, { data: profile, expiresAt: Date.now() + PROFILE_TTL_MS });
  return profile;
}
