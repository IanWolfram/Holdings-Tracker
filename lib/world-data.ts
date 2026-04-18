import { getNewsForTicker } from "./news";
import { fetchCompanyProfile } from "./company-profile";
import { writeStoryNote, writeDailySummary } from "../world-brain/obsidian";
import { WORLD_CACHE_TTL_MS, WORLD_VAULT_PATH } from "./constants";
import type { WorldData, GeoStory, CountryState, CompanyProfile } from "@/types/geo.types";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory } from "@/types/news.types";

// ---------------------------------------------------------------------------
// 15-minute module-level cache
// ---------------------------------------------------------------------------

let worldCache: { data: WorldData; expiresAt: number } | null = null;

// Background enrichment lock — Promise-based to prevent TOCTOU race
let enrichmentLock: Promise<void> | null = null;

// ---------------------------------------------------------------------------
// FAST PATH: Build WorldData using only already-classified stories
// No new Ollama calls. Stories from getNewsForTicker() already have
// BUY/SELL/HOLD verdicts from the Economic Brain. We map them to the
// company's HQ country as the default geo-origin.
// World-brain enrichment (geo-origin inference) runs async in background.
// ---------------------------------------------------------------------------

export async function getWorldData(positions: Position[]): Promise<WorldData> {
  if (worldCache && Date.now() < worldCache.expiresAt) return worldCache.data;

  if (positions.length === 0) {
    const empty: WorldData = { countries: {}, profiles: {}, fetchedAt: Date.now() };
    return empty;
  }

  // ── 1. Fetch all company profiles in parallel (24h cached, fast) ─────────
  const profileEntries = await Promise.all(
    positions.map(async (p) => {
      const prof = await fetchCompanyProfile(p.ticker).catch(() => null);
      return prof ? ([p.ticker, prof] as [string, CompanyProfile]) : null;
    })
  );
  const profiles = Object.fromEntries(
    profileEntries.filter((e): e is [string, CompanyProfile] => e !== null)
  );

  // ── 2. Collect already-classified stories (no new Ollama calls) ───────────
  // getNewsForTicker() uses its own 5-min cache and already ran the
  // Economic Brain classifier. We reuse those results directly.
  const allGeoStories: GeoStory[] = [];

  const newsResults = await Promise.all(
    positions.map(async (p) => {
      try {
        const sector = profiles[p.ticker]?.sector;
        return await getNewsForTicker(p.ticker, sector);
      } catch {
        return [];
      }
    })
  );

  for (const stories of newsResults) {
    for (const story of stories) {
      // Default geo-origin = ticker's HQ country (fast, no Ollama needed)
      const profile = profiles[story.ticker];
      const defaultCountryCode = profile?.countryCode ?? undefined;

      const geoStory: GeoStory = {
        ticker: story.ticker,
        headline: story.headline,
        summary: story.summary ?? "",
        url: story.url,
        datetime: story.datetime,
        verdict: story.verdict,
        confidence: story.confidence,
        reason: story.reason,
        source: story.source,
        // Use existing originCountry if world-brain already enriched it,
        // otherwise default to HQ country
        originCountryCode: story.originCountry ?? defaultCountryCode,
        // Use existing relevanceScore if set, otherwise use confidence
        relevanceScore: story.relevanceScore ?? story.confidence,
      };

      allGeoStories.push(geoStory);
    }
  }

  // ── 3. Write individual story notes to Obsidian vault ────────────────────
  if (WORLD_VAULT_PATH && allGeoStories.length > 0) {
    for (const story of allGeoStories) {
      const sector = profiles[story.ticker]?.sector;
      writeStoryNote(story, WORLD_VAULT_PATH, sector);
    }
  }

  // ── 4. Build country states ───────────────────────────────────────────────
  const countries: Record<string, CountryState> = {};

  // HQ countries from profiles
  for (const [ticker, profile] of Object.entries(profiles)) {
    const code = profile.countryCode;
    if (!countries[code]) {
      countries[code] = {
        countryCode: code,
        netVerdict: null,
        netScore: 0,
        stories: [],
        isHQCountry: true,
        hqTickers: [],
        totalPositionValue: 0,
      };
    }
    countries[code].isHQCountry = true;
    if (!countries[code].hqTickers.includes(ticker)) {
      countries[code].hqTickers.push(ticker);
    }
    const pos = positions.find((p) => p.ticker === ticker);
    countries[code].totalPositionValue += pos?.marketValue ?? 0;
  }

  // News stories → their geo-origin country
  for (const story of allGeoStories) {
    if (!story.originCountryCode) continue;
    const code = story.originCountryCode;
    if (!countries[code]) {
      countries[code] = {
        countryCode: code,
        netVerdict: null,
        netScore: 0,
        stories: [],
        isHQCountry: false,
        hqTickers: [],
        totalPositionValue: 0,
      };
    }
    countries[code].stories.push(story);
  }

  // ── 5. Compute net sentiment per country ──────────────────────────────────
  for (const state of Object.values(countries)) {
    if (state.stories.length === 0) {
      state.netVerdict = null;
      continue;
    }
    const score =
      state.stories.reduce((acc, s) => {
        const dir = s.verdict === "BUY" ? 1 : s.verdict === "SELL" ? -1 : 0;
        return acc + dir * s.confidence * s.relevanceScore;
      }, 0) / state.stories.length;

    state.netScore = score;
    state.netVerdict = score > 0.15 ? "BUY" : score < -0.15 ? "SELL" : "HOLD";
  }

  const data: WorldData = { countries, profiles, fetchedAt: Date.now() };
  worldCache = { data, expiresAt: Date.now() + WORLD_CACHE_TTL_MS };

  // Write daily summary now that `data` is available
  if (WORLD_VAULT_PATH && allGeoStories.length > 0) {
    const today = new Date().toISOString().split("T")[0];
    writeDailySummary(today, allGeoStories, WORLD_VAULT_PATH, data);
  }

  // ── 6. Kick off background world-brain enrichment (non-blocking) ──────────
  // This runs AFTER we've returned the fast response. It will refine
  // geo-origin inference via Ollama and update the cache for next poll.
  if (!enrichmentLock) {
    enrichmentLock = runBackgroundEnrichment(data, positions, profiles)
      .catch((err) => console.error("[world-data] Background enrichment error:", err))
      .finally(() => { enrichmentLock = null; });
  }

  return data;
}

// ---------------------------------------------------------------------------
// Background enrichment — runs async, updates cache when done
// World-brain Ollama calls happen here, not on the critical path
// ---------------------------------------------------------------------------

async function runBackgroundEnrichment(
  baseData: WorldData,
  positions: Position[],
  profiles: Record<string, CompanyProfile>
): Promise<void> {
  console.info("[world-data] Starting background world-brain enrichment…");

  try {
    const { analyzeStory } = await import("../world-brain/brain");

    const holdingTickers = positions.map((p) => p.ticker);
    const holdingSectors = [
      ...new Set(Object.values(profiles).map((p) => p.sector).filter(Boolean)),
    ];

    // Re-fetch cached stories (already in memory, no API calls)
    const allEnriched: GeoStory[] = [];

    for (const position of positions) {
      let stories: ClassifiedStory[] = [];
      try {
        const { getNewsForTicker } = await import("./news");
        const sector = profiles[position.ticker]?.sector;
        stories = await getNewsForTicker(position.ticker, sector);
      } catch {
        continue;
      }

      for (const story of stories) {
        // Skip if already enriched with a non-HQ country
        const profile = profiles[story.ticker];
        const hqCode = profile?.countryCode;
        const alreadyEnriched =
          story.originCountry && story.originCountry !== hqCode;
        if (alreadyEnriched) {
          allEnriched.push({
            ticker: story.ticker,
            headline: story.headline,
            summary: story.summary ?? "",
            url: story.url,
            datetime: story.datetime,
            verdict: story.verdict,
            confidence: story.confidence,
            reason: story.reason,
            source: story.source,
            originCountryCode: story.originCountry,
            relevanceScore: story.relevanceScore ?? story.confidence,
          });
          continue;
        }

        let analysis;
        try {
          analysis = await analyzeStory(
            story.ticker,
            story.headline,
            story.summary ?? "",
            holdingTickers,
            holdingSectors
          );
        } catch {
          analysis = null;
        }

        allEnriched.push({
          ticker: story.ticker,
          headline: story.headline,
          summary: story.summary ?? "",
          url: story.url,
          datetime: story.datetime,
          verdict: analysis?.verdict ?? story.verdict,
          confidence: analysis?.confidence ?? story.confidence,
          reason: analysis?.reason || story.reason,
          source: story.source,
          originCountryCode: analysis?.originCountryCode ?? hqCode,
          relevanceScore: analysis?.relevanceScore ?? 0,
        });
      }
    }

    // Rebuild country states with enriched geo data
    const countries: Record<string, CountryState> = {};

    for (const [ticker, profile] of Object.entries(profiles)) {
      const code = profile.countryCode;
      if (!countries[code]) {
        countries[code] = {
          countryCode: code, netVerdict: null, netScore: 0,
          stories: [], isHQCountry: true, hqTickers: [], totalPositionValue: 0,
        };
      }
      countries[code].isHQCountry = true;
      if (!countries[code].hqTickers.includes(ticker)) countries[code].hqTickers.push(ticker);
      const pos = positions.find((p) => p.ticker === ticker);
      countries[code].totalPositionValue += pos?.marketValue ?? 0;
    }

    for (const story of allEnriched) {
      if (!story.originCountryCode) continue;
      const code = story.originCountryCode;
      if (!countries[code]) {
        countries[code] = {
          countryCode: code, netVerdict: null, netScore: 0,
          stories: [], isHQCountry: false, hqTickers: [], totalPositionValue: 0,
        };
      }
      countries[code].stories.push(story);
    }

    for (const state of Object.values(countries)) {
      if (state.stories.length === 0) { state.netVerdict = null; continue; }
      const score = state.stories.reduce((acc, s) => {
        const dir = s.verdict === "BUY" ? 1 : s.verdict === "SELL" ? -1 : 0;
        return acc + dir * s.confidence * s.relevanceScore;
      }, 0) / state.stories.length;
      state.netScore = score;
      state.netVerdict = score > 0.15 ? "BUY" : score < -0.15 ? "SELL" : "HOLD";
    }

    // Update cache with enriched data — client picks this up on next 15-min poll
    const enriched: WorldData = {
      countries,
      profiles: baseData.profiles,
      fetchedAt: Date.now(),
    };
    worldCache = { data: enriched, expiresAt: Date.now() + WORLD_CACHE_TTL_MS };
    console.info("[world-data] Background enrichment complete.");
  }
}

/**
 * Invalidate the world cache (call after manual refresh).
 */
export function invalidateWorldCache(): void {
  worldCache = null;
}
