export interface RedditPost {
  text: string;
  url: string;
  datetime: number; // unix timestamp
  author: string;
  source: "reddit";
}

// In-memory rate limit: max 1 request per ticker per 5-minute window
const lastFetchedAt = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000;

const SUBREDDITS = "investing+stocks";

export async function fetchRedditPosts(
  ticker: string,
  companyName: string,
  sector?: string
): Promise<RedditPost[]> {
  const now = Date.now();
  const last = lastFetchedAt.get(ticker) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return [];
  }
  lastFetchedAt.set(ticker, now);

  // Use $TICKER notation (standard in stock discussion communities)
  const queryTerms =
    companyName.toLowerCase() !== ticker.toLowerCase()
      ? `$${ticker} OR "${companyName}"`
      : `$${ticker}`;
  const query = encodeURIComponent(queryTerms);

  const url = `https://www.reddit.com/r/${SUBREDDITS}/search.json?q=${query}&restrict_sr=1&sort=new&t=month&limit=25`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Holdings-Tracker/1.0",
    },
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

  // Deduplicate by title, limit to 15
  const seen = new Set<string>();
  const posts: RedditPost[] = [];

  const lowerSector = sector?.toLowerCase() ?? "";
  const isPharma = lowerSector.includes("pharma") || lowerSector.includes("health");
  const exclusionKeywords = isPharma ? ["raspberry", "sbc", "linux", "hardware", "cpu", "compute"] : [];

  for (const child of children) {
    const { title, selftext, permalink, author, created_utc } = child.data;
    const text = title?.trim() ?? "";
    if (!text || seen.has(text)) continue;

    const lowerText = text.toLowerCase();
    const lowerBody = (selftext ?? "").toLowerCase();

    // Basic disambiguation: if we are looking for a Pharma stock, skip hardware-heavy posts
    if (exclusionKeywords.length > 0) {
      const hasExclusion = exclusionKeywords.some(k => lowerText.includes(k) || lowerBody.includes(k));
      if (hasExclusion) continue;
    }

    seen.add(text);

    const body = selftext?.trim() ?? "";
    posts.push({
      text: body ? `${text}\n\n${body}` : text,
      url: permalink ? `https://www.reddit.com${permalink}` : `https://www.reddit.com/r/${SUBREDDITS}/`,
      datetime: created_utc ?? 0,
      author: author ?? "unknown",
      source: "reddit",
    });

    if (posts.length >= 15) break;
  }

  return posts;
}
