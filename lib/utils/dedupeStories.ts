import type { ClassifiedStory } from "@/types/news.types";
import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  DUPLICATE_MIN_TOKENS,
} from "@/lib/constants";

// Thresholds
const SAME_ARTICLE_JACCARD = 0.80; // Same article from different source → silently absorb
const SAME_HEADLINE_MIN_LEN = 15; // Minimum headline length for exact-match dedup

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "its", "from", "but", "not",
  "also", "more", "new", "are", "was", "were", "been", "has", "have", "had",
  "will", "says", "said", "after", "before", "into", "out", "off", "than",
  "then", "now", "today", "yesterday", "amid", "over", "under", "via",
  "about", "against", "between", "among", "during", "while", "when",
  "where", "which", "what", "who", "why", "how",
]);

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src",
  "_hsenc", "_hsmi", "igshid", "yclid", "msclkid",
]);

const SOURCE_PRIORITY: Record<string, number> = {
  polygon: 3,  // Polygon has fuller summaries
  finnhub: 2,  // Finnhub summaries are often truncated mid-sentence
  newsapi: 1,
};

export function canonicalizeUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const params = Array.from(u.searchParams.keys());
    for (const key of params) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }
    let out = u.toString();
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

function tokenize(
  text: string,
  ticker: string,
  companyName?: string,
): Set<string> {
  if (!text) return new Set();
  const tickerLc = ticker.toLowerCase();
  const companyTokens = new Set<string>();
  if (companyName) {
    for (const t of companyName.toLowerCase().split(/\s+/)) {
      if (t.length >= 3) companyTokens.add(t);
    }
  }
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .filter((t) => !STOPWORDS.has(t))
    .filter((t) => t !== tickerLc)
    .filter((t) => !companyTokens.has(t));
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size < DUPLICATE_MIN_TOKENS || b.size < DUPLICATE_MIN_TOKENS) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

function summaryCompleteness(summary: string | undefined): number {
  if (!summary) return 0;
  const trimmed = summary.trim();
  if (!trimmed) return 0;
  const lastChar = trimmed[trimmed.length - 1];
  // Complete sentence gets higher score
  const endsWithPunctuation = /[.!?]/.test(lastChar) ? 1 : 0;
  // Longer summaries are generally more informative
  const lengthScore = Math.min(trimmed.length / 500, 1);
  return endsWithPunctuation + lengthScore;
}

function pickCanonical(cluster: ClassifiedStory[]): ClassifiedStory {
  return [...cluster].sort((a, b) => {
    // Prefer stories with more complete summaries
    const sa = summaryCompleteness(a.summary);
    const sb = summaryCompleteness(b.summary);
    if (Math.abs(sa - sb) > 0.5) return sb - sa;
    const pa = SOURCE_PRIORITY[a.source] ?? -1;
    const pb = SOURCE_PRIORITY[b.source] ?? -1;
    if (pa !== pb) return pb - pa;
    const ca = a.confidence ?? 0;
    const cb = b.confidence ?? 0;
    if (ca !== cb) return cb - ca;
    const aa = a.isAnalyzed === true ? 1 : 0;
    const ab = b.isAnalyzed === true ? 1 : 0;
    if (aa !== ab) return ab - aa;
    return (a.datetime ?? 0) - (b.datetime ?? 0);
  })[0];
}

function normalizeHeadline(h: string): string {
  return h
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeStories(
  stories: ClassifiedStory[],
  companyName?: string,
): ClassifiedStory[] {
  const n = stories.length;
  if (n <= 1) return stories;

  const urls = stories.map((s) => canonicalizeUrl(s.url));

  // Phase 1: Exact URL dedup — same article from different providers.
  // Silently absorb: pick the best version, discard the rest (no +1 badge).
  const exactDeduped: ClassifiedStory[] = [];
  const seenUrls = new Map<string, ClassifiedStory[]>();
  for (let i = 0; i < n; i++) {
    const url = urls[i];
    if (!url) { exactDeduped.push(stories[i]); continue; }
    if (!seenUrls.has(url)) {
      seenUrls.set(url, [stories[i]]);
    } else {
      seenUrls.get(url)!.push(stories[i]);
    }
  }
  for (const group of seenUrls.values()) {
    if (group.length === 1) {
      exactDeduped.push(group[0]);
    } else {
      // Same article from multiple providers — pick the best, silently absorb the rest
      exactDeduped.push(pickCanonical(group));
    }
  }

  // Phase 1.5: Same article, different URL — same headline or near-identical content.
  // Silently absorb (no +1 badge): the story is the same, just surfaced by different providers.
  if (exactDeduped.length > 1) {
    const articleTokens = exactDeduped.map((s) =>
      tokenize(`${s.headline} ${s.summary ?? ""}`, s.ticker, companyName),
    );
    const articleUF = new UnionFind(exactDeduped.length);

    for (let i = 0; i < exactDeduped.length; i++) {
      for (let j = i + 1; j < exactDeduped.length; j++) {
        const a = exactDeduped[i];
        const b = exactDeduped[j];

        // Check 1: Identical normalized headline (catches different-URL, same-article)
        const hlA = normalizeHeadline(a.headline);
        const hlB = normalizeHeadline(b.headline);
        if (hlA.length >= SAME_HEADLINE_MIN_LEN && hlA === hlB) {
          articleUF.union(i, j);
          continue;
        }

        // Check 2: Near-identical Jaccard similarity (catches slight headline variations)
        const sim = jaccard(articleTokens[i], articleTokens[j]);
        if (sim >= SAME_ARTICLE_JACCARD) {
          articleUF.union(i, j);
        }
      }
    }

    const articleClusters = new Map<number, ClassifiedStory[]>();
    for (let i = 0; i < exactDeduped.length; i++) {
      const root = articleUF.find(i);
      if (!articleClusters.has(root)) articleClusters.set(root, []);
      articleClusters.get(root)!.push(exactDeduped[i]);
    }

    const afterArticleDedup: ClassifiedStory[] = [];
    for (const cluster of articleClusters.values()) {
      if (cluster.length === 1) {
        afterArticleDedup.push(cluster[0]);
      } else {
        // Same article — silently absorb, pick the best version
        afterArticleDedup.push(pickCanonical(cluster));
      }
    }

    // Replace exactDeduped with article-deduped result
    exactDeduped.length = 0;
    exactDeduped.push(...afterArticleDedup);
  }

  // Phase 2: Topic similarity dedup — different articles about the same general topic.
  // These get the +1 badge to indicate additional coverage from other sources.
  if (exactDeduped.length <= 1) return exactDeduped;

  const m = exactDeduped.length;
  const topicTokens = exactDeduped.map((s) =>
    tokenize(`${s.headline} ${s.summary ?? ""}`, s.ticker, companyName),
  );
  const uf = new UnionFind(m);

  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      const sim = jaccard(topicTokens[i], topicTokens[j]);
      if (sim >= DUPLICATE_SIMILARITY_THRESHOLD) {
        uf.union(i, j);
      }
    }
  }

  const clusters = new Map<number, ClassifiedStory[]>();
  for (let i = 0; i < m; i++) {
    const root = uf.find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(exactDeduped[i]);
  }

  const result: ClassifiedStory[] = [];
  for (const cluster of clusters.values()) {
    if (cluster.length === 1) {
      result.push(cluster[0]);
      continue;
    }
    const canonical = pickCanonical(cluster);
    const dupes = cluster
      .filter((s) => s !== canonical)
      .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0));

    result.push({ ...canonical, duplicates: dupes });
  }

  return result;
}
