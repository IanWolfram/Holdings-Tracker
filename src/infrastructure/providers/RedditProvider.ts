import type { INewsProvider, RawNewsItem } from "@/src/domain/interfaces/INewsProvider";

const RATE_LIMIT_MS = 5 * 60 * 1000;
const lastFetchedAt = new Map<string, number>();
const SUBREDDITS = "investing+stocks";

export class RedditProvider implements INewsProvider {
  async fetchNews(ticker: string, companyName?: string, sector?: string): Promise<RawNewsItem[]> {
    const now = Date.now();
    const last = lastFetchedAt.get(ticker) ?? 0;
    if (now - last < RATE_LIMIT_MS) return [];
    lastFetchedAt.set(ticker, now);

    const name = companyName ?? ticker;
    const queryTerms =
      name.toLowerCase() !== ticker.toLowerCase()
        ? `$${ticker} OR "${name}"`
        : `$${ticker}`;
    const query = encodeURIComponent(queryTerms);
    const url = `https://www.reddit.com/r/${SUBREDDITS}/search.json?q=${query}&restrict_sr=1&sort=new&t=month&limit=25`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Holdings-Tracker/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Reddit request failed ${res.status}: ${body}`);
    }

    const json = await res.json();
    const children: Array<{
      data: {
        title?: string;
        selftext?: string;
        permalink?: string;
        author?: string;
        created_utc?: number;
      };
    }> = json?.data?.children ?? [];

    const lowerSector = sector?.toLowerCase() ?? "";
    const isPharma = lowerSector.includes("pharma") || lowerSector.includes("health");
    const exclusionKeywords = isPharma
      ? ["raspberry", "sbc", "linux", "hardware", "cpu", "compute"]
      : [];

    const seen = new Set<string>();
    const posts: RawNewsItem[] = [];

    for (const child of children) {
      const { title, selftext, permalink, author, created_utc } = child.data;
      const text = title?.trim() ?? "";
      if (!text || seen.has(text)) continue;

      if (exclusionKeywords.length > 0) {
        const lowerText = text.toLowerCase();
        const lowerBody = (selftext ?? "").toLowerCase();
        if (exclusionKeywords.some((k) => lowerText.includes(k) || lowerBody.includes(k))) continue;
      }

      seen.add(text);
      const body = selftext?.trim() ?? "";
      posts.push({
        headline: text.slice(0, 120),
        summary: body ? `${text}\n\n${body}` : text,
        url: permalink
          ? `https://www.reddit.com${permalink}`
          : `https://www.reddit.com/r/${SUBREDDITS}/`,
        datetime: created_utc ?? 0,
        author: author ?? "unknown",
        source: "reddit",
      });

      if (posts.length >= 15) break;
    }

    return posts;
  }
}
