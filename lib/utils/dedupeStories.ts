import type { ClassifiedStory } from "@/types/news.types";
import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  DUPLICATE_MIN_TOKENS,
} from "@/lib/constants";

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
  finnhub: 3,
  newsapi: 2,
  reddit: 1,
  twitter: 0,
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

function pickCanonical(cluster: ClassifiedStory[]): ClassifiedStory {
  return [...cluster].sort((a, b) => {
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

export function dedupeStories(
  stories: ClassifiedStory[],
  companyName?: string,
): ClassifiedStory[] {
  const n = stories.length;
  if (n <= 1) return stories;

  const tokens = stories.map((s) =>
    tokenize(`${s.headline} ${s.summary ?? ""}`, s.ticker, companyName),
  );
  const urls = stories.map((s) => canonicalizeUrl(s.url));
  const uf = new UnionFind(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s1 = stories[i];
      const s2 = stories[j];
      
      // Don't dedupe across major source types (e.g. don't merge a Reddit post into a Finnhub article)
      const isSocial1 = s1.source === "reddit" || s1.source === "twitter";
      const isSocial2 = s2.source === "reddit" || s2.source === "twitter";
      if (isSocial1 !== isSocial2) continue;

      const sameUrl = urls[i] && urls[j] && urls[i] === urls[j];
      const sim = jaccard(tokens[i], tokens[j]);
      if (sameUrl || sim >= DUPLICATE_SIMILARITY_THRESHOLD) {
        uf.union(i, j);
      }
    }
  }

  const clusters = new Map<number, ClassifiedStory[]>();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(stories[i]);
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

    const minT = Math.min(...cluster.map((s) => s.datetime ?? 0));
    const maxT = Math.max(...cluster.map((s) => s.datetime ?? 0));
    if (maxT - minT > 24 * 60 * 60) {
      console.warn(
        `[dedupe] Cluster spans >24h for ${canonical.ticker}: "${canonical.headline}" (${cluster.length} stories)`,
      );
    }

    result.push({ ...canonical, duplicates: dupes });
  }

  return result;
}
