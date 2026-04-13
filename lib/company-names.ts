const BASE_URL = "https://finnhub.io/api/v1";

// Permanent in-memory cache — company names don't change
const nameCache = new Map<string, string>();

export async function getCompanyName(ticker: string): Promise<string> {
  if (nameCache.has(ticker)) return nameCache.get(ticker)!;

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return ticker;

  try {
    const url = `${BASE_URL}/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${key}`;
    const res = await fetch(url);
    if (!res.ok) return ticker;

    const data: { name?: string } = await res.json();
    const name = data.name?.trim() || ticker;
    nameCache.set(ticker, name);
    return name;
  } catch {
    return ticker;
  }
}
