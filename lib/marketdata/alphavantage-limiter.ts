
const FREE_DAILY_BUDGET = 20; // Use 20 of 25 to leave headroom
const BURST_LIMIT_MS = 1100; // 1.1s to be safe (Alpha Vantage says 1s)
const DAILY_LIMIT_COOLDOWN_MS = 12 * 60 * 60 * 1000;

let lastRequestTime = 0;
let isDailyLimitReached = false;
let limitReachedAt = 0;
let dailyCount = 0;
let dailyCountDay = 0; // YYYY-MM-DD string to track day rollover

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getAlphaVantageDailyUsage(): { used: number; budget: number; remaining: number } {
  return { used: dailyCount, budget: FREE_DAILY_BUDGET, remaining: FREE_DAILY_BUDGET - dailyCount };
}

export async function fetchWithAlphaVantageRateLimit(url: string): Promise<any> {
  const now = Date.now();

  // Day rollover
  const day = today();
  if (day !== dailyCountDay) {
    dailyCount = 0;
    dailyCountDay = day;
  }

  // Hard cooldown after hitting the real limit
  if (isDailyLimitReached) {
    if (now - limitReachedAt < DAILY_LIMIT_COOLDOWN_MS) {
      throw new Error("Alpha Vantage daily limit reached (cooldown active)");
    }
    isDailyLimitReached = false;
  }

  // Proactive budget check — stop before we hit the real limit
  if (dailyCount >= FREE_DAILY_BUDGET) {
    throw new Error(`Alpha Vantage daily budget exhausted (${dailyCount}/${FREE_DAILY_BUDGET})`);
  }

  // Burst limit
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < BURST_LIMIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, BURST_LIMIT_MS - timeSinceLast));
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  lastRequestTime = Date.now();
  dailyCount++;

  if (!res.ok) {
    throw new Error(`Alpha Vantage HTTP ${res.status}`);
  }

  const json = await res.json();

  // Check for rate limit messages in response body
  const info = json["Information"] || json["Note"] || json["Error Message"];
  if (info && (info.includes("rate limit") || info.includes("spread out your free API requests"))) {
    if (info.includes("25 requests per day") || info.includes("daily limit")) {
      isDailyLimitReached = true;
      limitReachedAt = Date.now();
      console.warn("[Alpha Vantage] Daily limit reached. Cooling down for 12 hours.");
    }
    throw new Error(`Alpha Vantage Rate Limit: ${info}`);
  }

  return json;
}
