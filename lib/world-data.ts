import { getServices } from "@/src/registry";
import { fetchCompanyProfile } from "./company-profile";
import { writeStoryNote, writeDailySummary } from "../world-brain/obsidian";
import { WORLD_CACHE_TTL_MS, WORLD_VAULT_PATH, VERDICT_THRESHOLD } from "./constants";
import { FsVaultStore } from "@/lib/vault/store";
import type { WorldData, GeoStory, CountryState, CompanyProfile } from "@/types/geo.types";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory } from "@/types/news.types";

// ---------------------------------------------------------------------------
// Stale-while-revalidate world-data cache
// ---------------------------------------------------------------------------

let worldCache: { data: WorldData; expiresAt: number } | null = null;

// Background enrichment lock — Promise-based to prevent TOCTOU race
let enrichmentLock: Promise<void> | null = null;
// Background revalidation lock — prevents duplicate refreshes
let revalidationLock: Promise<void> | null = null;

/**
 * SWR-style fetch: returns cached data immediately (even if stale),
 * and kicks off background revalidation if the cache is stale or empty.
 */
export async function getWorldData(
  positions: Position[],
  opts?: { mock?: boolean }
): Promise<WorldData> {
  // Return fresh cache immediately
  if (worldCache && Date.now() < worldCache.expiresAt) return worldCache.data;

  // Return stale cache immediately, trigger background revalidation
  if (worldCache) {
    if (!revalidationLock) {
      revalidationLock = refreshWorldData(positions, opts)
        .then(() => {})
        .catch((err) => console.error("[world-data] Background revalidation failed:", err))
        .finally(() => { revalidationLock = null; });
    }
    return worldCache.data;
  }

  // No cache at all — must fetch blocking
  return refreshWorldData(positions, opts);
}

/**
 * Force-invalidate cache (used by the manual refresh endpoint).
 * Returns immediately; the next getWorldData call will fetch fresh data.
 */
export function invalidateWorldCache(): void {
  worldCache = null;
}

/**
 * Force a fresh fetch regardless of cache state (used by /api/world-refresh).
 */
export async function forceRefreshWorldData(
  positions: Position[],
  opts?: { mock?: boolean }
): Promise<WorldData> {
  worldCache = null;
  return refreshWorldData(positions, opts);
}

// ---------------------------------------------------------------------------
// Core data-building logic (extracted from old getWorldData)
// ---------------------------------------------------------------------------

async function refreshWorldData(
  positions: Position[],
  opts?: { mock?: boolean }
): Promise<WorldData> {
  if (positions.length === 0) {
    // Don't poison the cache with an empty result — positions may simply not
    // have loaded yet (e.g. E*TRADE tokens still being fetched). Caching empty
    // for the full TTL would leave the globe blank for 15 minutes.
    return { countries: {}, profiles: {}, fetchedAt: Date.now() };
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
  const allGeoStories: GeoStory[] = [];
  const { newsService } = getServices();

  const newsResults = await Promise.all(
    positions.map(async (p) => {
      try {
        const sector = profiles[p.ticker]?.sector;
        return await newsService.getNewsForTicker(p.ticker, sector);
      } catch {
        return [];
      }
    })
  );

  for (const stories of newsResults) {
    for (const story of stories) {
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
        originCountryCode: story.originCountryCode ?? defaultCountryCode,
        relevanceScore: story.relevanceScore ?? story.confidence,
        isAnalyzed: story.isAnalyzed,
      };

      allGeoStories.push(geoStory);
    }
  }

  // ── 3. Write individual story notes to Obsidian vault ────────────────────
  if (WORLD_VAULT_PATH && allGeoStories.length > 0 && !opts?.mock) {
    const store = new FsVaultStore(WORLD_VAULT_PATH);
    await Promise.all(
      allGeoStories.map((story) => {
        const sector = profiles[story.ticker]?.sector;
        return writeStoryNote(story, store, sector ?? undefined);
      })
    );
  }

  // ── 4. Build country states ───────────────────────────────────────────────
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

  for (const story of allGeoStories) {
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

  // ── 5. Compute net sentiment per country ──────────────────────────────────
  for (const state of Object.values(countries)) {
    if (state.stories.length === 0) { state.netVerdict = null; continue; }
    const score =
      state.stories.reduce((acc, s) => {
        const dir = s.verdict === "BUY" ? 1 : s.verdict === "SELL" ? -1 : 0;
        return acc + dir * s.confidence * s.relevanceScore;
      }, 0) / state.stories.length;

    state.netScore = score;
    state.netVerdict = score > VERDICT_THRESHOLD ? "BUY" : score < -VERDICT_THRESHOLD ? "SELL" : "HOLD";
  }

  const data: WorldData = { countries, profiles, fetchedAt: Date.now() };
  worldCache = { data, expiresAt: Date.now() + WORLD_CACHE_TTL_MS };

  // Write daily summary
  if (WORLD_VAULT_PATH && allGeoStories.length > 0 && !opts?.mock) {
    const today = new Date().toISOString().split("T")[0];
    const store = new FsVaultStore(WORLD_VAULT_PATH);
    await writeDailySummary(today, allGeoStories, store, data);
  }

  // ── 6. Kick off background world-brain enrichment (non-blocking) ──────────
  if (process.env.ENABLE_BACKGROUND_ENRICHMENT === "true" && !enrichmentLock) {
    enrichmentLock = runBackgroundEnrichment(data, positions, profiles)
      .catch((err) => console.error("[world-data] Background enrichment error:", err))
      .finally(() => { enrichmentLock = null; });
  }

  return data;
}

// ---------------------------------------------------------------------------
// Background enrichment — runs async, updates cache when done
// ---------------------------------------------------------------------------

async function runBackgroundEnrichment(
  baseData: WorldData,
  positions: Position[],
  profiles: Record<string, CompanyProfile>
): Promise<void> {
  console.info("[world-data] Starting background world-brain enrichment…");

  try {
    const { analyzeStory } = await import("../world-brain/brain");
    const store = WORLD_VAULT_PATH ? new FsVaultStore(WORLD_VAULT_PATH) : null;

    const holdingTickers = positions.map((p) => p.ticker);
    const holdingSectors = [
      ...new Set(Object.values(profiles).map((p) => p.sector).filter(Boolean)),
    ];

    const allEnriched: GeoStory[] = [];

    for (const position of positions) {
      let stories: ClassifiedStory[] = [];
      try {
        const sector = profiles[position.ticker]?.sector;
        stories = await getServices().newsService.getNewsForTicker(position.ticker, sector);
      } catch {
        continue;
      }

      for (const story of stories) {
        const profile = profiles[story.ticker];
        const hqCode = profile?.countryCode;
        const alreadyEnriched =
          story.originCountryCode && story.originCountryCode !== hqCode;
        if (alreadyEnriched) {
          allEnriched.push({
            ticker: story.ticker, headline: story.headline, summary: story.summary ?? "",
            url: story.url, datetime: story.datetime, verdict: story.verdict,
            confidence: story.confidence, reason: story.reason, source: story.source,
            originCountryCode: story.originCountryCode ?? undefined,
            relevanceScore: story.relevanceScore ?? story.confidence,
          });
          continue;
        }

        let analysis;
        try {
          analysis = await analyzeStory(
            story.ticker, story.headline, story.summary ?? "",
            holdingTickers, holdingSectors
          );
        } catch {
          analysis = null;
        }

        allEnriched.push({
          ticker: story.ticker, headline: story.headline, summary: story.summary ?? "",
          url: story.url, datetime: story.datetime,
          verdict: analysis?.verdict ?? story.verdict,
          confidence: analysis?.confidence ?? story.confidence,
          reason: analysis?.reason || story.reason, source: story.source,
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
      state.netVerdict = score > VERDICT_THRESHOLD ? "BUY" : score < -VERDICT_THRESHOLD ? "SELL" : "HOLD";
    }

    const enriched: WorldData = {
      countries,
      profiles: baseData.profiles,
      fetchedAt: Date.now(),
    };
    worldCache = { data: enriched, expiresAt: Date.now() + WORLD_CACHE_TTL_MS };
    console.info("[world-data] Background enrichment complete.");
  } catch (err) {
    console.error("[world-data] Enrichment failed:", err);
  }
}