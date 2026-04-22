/**
 * Polygon.io Utility for high-fidelity market data
 */

// Free tier: 5 calls/minute = 1 per 12 s. Use 13 s to stay safely under.
let polygonQueue: Promise<void> = Promise.resolve();
let lastPolygonCallAt = 0;
const POLYGON_RATE_MS = 13_000;

function enqueuePolygon<T>(fn: () => Promise<T>): Promise<T> {
  const result = polygonQueue.then(async () => {
    const wait = POLYGON_RATE_MS - (Date.now() - lastPolygonCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastPolygonCallAt = Date.now();
    return fn();
  });
  polygonQueue = result.then(() => {}, () => {});
  return result;
}

// AbortSignal is created fresh inside the queue so the 15s timeout only
// starts counting once the request is actually about to fire.
async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (res.status !== 429) return res;
    const backoff = 15_000 * (attempt + 1);
    console.warn(`[polygon] 429 on attempt ${attempt + 1}, retrying in ${backoff / 1000}s`);
    await new Promise((r) => setTimeout(r, backoff));
  }
  throw new Error("Polygon HTTP 429 after retries");
}

export async function fetchCandlesPolygon(
  ticker: string,
  days: number = 90
): Promise<number[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.warn("[polygon] POLYGON_API_KEY not set");
    return [];
  }

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - days);

  const to = toDate.toISOString().split("T")[0];
  const from = fromDate.toISOString().split("T")[0];

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${apiKey}`;

  return enqueuePolygon(async () => {
    try {
      const res = await fetchWithRetry(url);
      if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);

      const data = await res.json();
      // Free tier returns "DELAYED" instead of "OK" — treat both as valid
      if ((data.status === "OK" || data.status === "DELAYED") && Array.isArray(data.results)) {
        console.log(`[polygon] Fetched ${data.results.length} candles for ${ticker} (${data.status})`);
        return data.results.map((r: { c: number }) => r.c);
      }

      console.warn(`[polygon] No results for ${ticker}:`, data.status);
      return [];
    } catch (err) {
      console.error(`[polygon] Error for ${ticker}:`, err);
      return [];
    }
  });
}
