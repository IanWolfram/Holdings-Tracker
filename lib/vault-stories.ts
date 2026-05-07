import { getVaultIndex, type VaultEntry } from "./vault-index";
import type { ClassifiedStory } from "@/types/news.types";
import { getVaultStore } from "./vault/store";

const DEFAULT_WINDOW_DAYS = 7;

function vaultEntryToStory(entry: VaultEntry, originalUrl: string): ClassifiedStory | null {
  if (!entry.ticker || !entry.headline) return null;

  // Use the original source for UI grouping/badges; fall back to "newsapi"
  const knownSources = ["finnhub", "polygon", "newsapi"] as const;
  const sourceValue = knownSources.includes(entry.source as any)
    ? (entry.source as "finnhub" | "polygon" | "newsapi")
    : ("newsapi" as const);

  if (!knownSources.includes(entry.source as any)) {
    console.warn(`[vault-stories] Rewriting unrecognized source "${entry.source}" to "newsapi" for ticker ${entry.ticker}`);
  }

  return {
    ticker: entry.ticker,
    headline: entry.headline,
    summary: entry.summary ?? "",
    url: originalUrl,
    datetime: entry.datetime,
    source: sourceValue,
    originalSource: entry.source,
    verdict: entry.verdict,
    confidence: entry.confidence,
    reason: entry.reason,
    relevanceScore: entry.relevanceScore,
    originCountryCode: entry.originCountryCode,
    catalystTypes: entry.catalystTypes,
    classifiedAt: entry.classifiedAt,
    isAnalyzed: entry.isAnalyzed,
    fromVault: true,
  };
}

export async function getVaultStoriesForTicker(
  ticker: string,
  windowDays: number = DEFAULT_WINDOW_DAYS
): Promise<ClassifiedStory[]> {
  const store = await getVaultStore("system");
  const index = await getVaultIndex(store);
  const cutoff = Math.floor(Date.now() / 1000) - (windowDays * 24 * 60 * 60);
  const upper = ticker.toUpperCase();

  const stories: ClassifiedStory[] = [];

  for (const [originalUrl, entry] of index.entries()) {
    if (entry.ticker?.toUpperCase() !== upper) continue;
    if (!entry.datetime || entry.datetime < cutoff) continue;

    const story = vaultEntryToStory(entry, originalUrl);
    if (story) stories.push(story);
  }

  return stories.sort((a, b) => b.datetime - a.datetime);
}