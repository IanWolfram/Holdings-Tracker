import type { VaultStore, VaultNote } from "@/lib/vault/store";
import type { Verdict, Classification } from "@/types/news.types";

export interface VaultEntry extends Classification {
  filePath: string;
  ticker: string;
  headline: string;
  summary: string;
  datetime: number;
  source: string;
}

interface CachedIndex {
  index: Map<string, VaultEntry>;
  builtAt: number;
}
const indexCache = new Map<string, CachedIndex>();
// The index is rebuilt from a full scan of the `news/` prefix (thousands of
// notes). A short TTL meant hot paths (classification, world data, the
// every-minute story_backlog cron) re-downloaded that scan constantly — the
// dominant driver of Supabase egress. 15 min keeps the index fresh enough
// (single new stories are patched in live via updateVaultIndex) while cutting
// rebuild frequency ~30x. Live single-story updates keep readers current between rebuilds.
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Extract catalystTypes from structured frontmatter.
 * The JSONB field is already an array — just cast it.
 */
function extractCatalystTypes(fm: Record<string, unknown>): Classification["catalystTypes"] {
  const raw = fm.catalystTypes;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw as Classification["catalystTypes"];
}

/**
 * Extract reason from the note body (## AI Analysis section),
 * falling back to frontmatter.reason.
 */
function extractReason(note: VaultNote): string | undefined {
  const fmReason = note.frontmatter.reason;
  if (typeof fmReason === "string" && fmReason.trim()) return fmReason.trim();

  const match = note.body.match(/## AI Analysis\n([\s\S]*?)(?:\n##|$)/);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract headline: prefer frontmatter, fall back to H1 in body.
 */
function extractHeadline(note: VaultNote): string {
  const fmHeadline = note.frontmatter.headline;
  if (typeof fmHeadline === "string" && fmHeadline.trim()) return fmHeadline.trim();

  const h1Match = note.body.match(/\n# (.+)/);
  return h1Match ? h1Match[1].trim() : "";
}

/**
 * Extract summary: prefer frontmatter (always written by the note writer),
 * fall back to the ## Summary section in the body when present. The index scan
 * fetches frontmatter only (no body), so the frontmatter path is the norm.
 */
function extractSummary(note: VaultNote): string {
  const fmSummary = note.frontmatter.summary;
  if (typeof fmSummary === "string" && fmSummary.trim()) return fmSummary.trim();

  const match = note.body.match(/## Summary\n([\s\S]*?)(?:\n##|$)/);
  return match ? match[1].trim() : "";
}

/**
 * Convert a date string to unix timestamp (seconds).
 */
function toUnixTimestamp(dateStr: unknown): number {
  if (typeof dateStr !== "string" || !dateStr) return 0;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
}

/**
 * Scans the World Vault via VaultStore and builds an in-memory index of news stories by URL.
 */
export async function getVaultIndex(
  store: VaultStore,
  userId: string = "system",
): Promise<Map<string, VaultEntry>> {
  const now = Date.now();
  const cached = indexCache.get(userId);
  if (cached && now - cached.builtAt < CACHE_TTL) {
    return cached.index;
  }

  const newIndex = new Map<string, VaultEntry>();
  try {
    // Frontmatter-only scan: the index reads verdict/confidence/headline/etc.
    // from frontmatter, so fetching each note's full body would be pure egress
    // waste. Body-fallback extractors degrade gracefully (frontmatter wins).
    const notes = await store.listNotesMeta("news/");
    for (const note of notes) {
      const fm = note.frontmatter;
      const url = fm.url;
      if (typeof url !== "string" || !url) continue;

      const catalystTypes = extractCatalystTypes(fm);
      const reason = extractReason(note);
      const headline = extractHeadline(note);
      const summary = extractSummary(note);
      const datetime = toUnixTimestamp(fm.date);

      newIndex.set(url, {
        verdict: fm.verdict as Verdict,
        confidence: typeof fm.confidence === "number" ? fm.confidence : parseFloat(String(fm.confidence ?? "0.9")),
        reason,
        relevanceScore: typeof fm.relevance === "number" ? fm.relevance : parseFloat(String(fm.relevance ?? "0")),
        originCountryCode: typeof fm.country === "string" ? fm.country : null,
        catalystTypes,
        classifiedAt: typeof fm.date === "string" ? fm.date : new Date().toISOString(),
        isAnalyzed: fm.verified === "true" || fm.verified === true,
        analysisFailed: fm.analysisFailed === "true" || fm.analysisFailed === true,
        fromVault: true,
        filePath: note.path,
        ticker: typeof fm.ticker === "string" ? fm.ticker : "",
        headline,
        summary,
        datetime,
        source: typeof fm.source === "string" ? fm.source : "unknown",
      });
    }
  } catch (err) {
    console.error("[vault-index] Failed to build index:", err);
  }

  indexCache.set(userId, { index: newIndex, builtAt: now });
  return newIndex;
}

/**
 * Updates the index with a single story without a full re-scan.
 * Applies to every cached per-user index that already contains the URL
 * (so a freshly classified story is visible to all readers immediately).
 */
export function updateVaultIndex(url: string, entry: VaultEntry, userId?: string): void {
  if (userId) {
    const cached = indexCache.get(userId);
    if (cached) cached.index.set(url, entry);
    return;
  }
  for (const cached of indexCache.values()) {
    if (cached.index.has(url)) cached.index.set(url, entry);
  }
}

/**
 * Clear the cache to force a re-scan. Without a userId, clears all users.
 */
export function invalidateVaultIndex(userId?: string): void {
  if (userId) indexCache.delete(userId);
  else indexCache.clear();
}