/**
 * Polygon.io Utility for high-fidelity market data
 */

export async function fetchCandlesPolygon(
  ticker: string,
  days: number = 90
): Promise<number[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.warn("[polygon] POLYGON_API_KEY not set");
    return [];
  }

  // Polygon uses YYYY-MM-DD
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - days);

  const to = toDate.toISOString().split("T")[0];
  const from = fromDate.toISOString().split("T")[0];

  // multiplier/timespan = 1/day
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${apiKey}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);
    
    const data = await res.json();
    if (data.status === "OK" && Array.isArray(data.results)) {
      console.log(`[polygon] Fetched ${data.results.length} candles for ${ticker}`);
      // 'c' is the close price in Polygon's aggregate response
      return data.results.map((r: any) => r.c);
    }
    
    console.warn(`[polygon] No results for ${ticker}:`, data.status);
    return [];
  } catch (err) {
    console.error(`[polygon] Error for ${ticker}:`, err);
    return [];
  }
}
