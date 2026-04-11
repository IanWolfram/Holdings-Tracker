export interface Tweet {
  text: string;
  url: string;
  datetime: number; // unix timestamp
  author: string;
  source: "twitter";
}

// In-memory rate limit: max 1 request per ticker per 5-minute window
const lastFetchedAt = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000;

export async function fetchTwitterNews(ticker: string): Promise<Tweet[]> {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) throw new Error("TWITTER_BEARER_TOKEN is not set");

  const now = Date.now();
  const last = lastFetchedAt.get(ticker) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    // Return empty rather than hitting rate limit
    return [];
  }
  lastFetchedAt.set(ticker, now);

  const startTime = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  const query = encodeURIComponent(`${ticker} stock lang:en -is:retweet`);
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=15&start_time=${startTime}&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twitter request failed ${res.status}: ${body}`);
  }

  const json = await res.json();
  const tweets: Array<{ id: string; text: string; created_at?: string; author_id?: string }> =
    json.data ?? [];
  const users: Array<{ id: string; username: string }> = json.includes?.users ?? [];
  const userMap = new Map(users.map((u) => [u.id, u.username]));

  return tweets.map((t) => ({
    text: t.text,
    url: `https://twitter.com/i/web/status/${t.id}`,
    datetime: t.created_at ? Math.floor(new Date(t.created_at).getTime() / 1000) : 0,
    author: t.author_id ? (userMap.get(t.author_id) ?? "unknown") : "unknown",
    source: "twitter" as const,
  }));
}
