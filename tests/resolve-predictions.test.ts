import { describe, expect, it } from "vitest";
import { resolveEligiblePredictions, loadPredictions, savePredictions } from "@/world-brain/predictions";
import type { TickerPrediction } from "@/types/predictions";
import type { DailyBar } from "@/lib/marketdata/prices";
import { InMemoryVaultStore } from "./helpers/InMemoryVaultStore";

const DAY_MS = 86_400_000;
const NOW_MS = Date.parse("2026-01-20T00:00:00.000Z");

function pending(overrides: Partial<TickerPrediction>): TickerPrediction {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    ticker: "AAPL",
    runAt: Date.parse("2026-01-05T15:00:00.000Z"),
    priceAtPrediction: 100,
    direction: "UP",
    magnitudePct: 5,
    horizonDays: 7,
    confidence: 0.7,
    reasoning: "test",
    catalysts: [],
    engine: "test-engine",
    status: "pending",
    ...overrides,
  };
}

function bar(date: string, close: number): DailyBar {
  return { date, open: close, high: close, low: close, close, volume: 1000 };
}

describe("resolveEligiblePredictions", () => {
  it("resolves against the close at the horizon DATE, not the run date", async () => {
    const store = new InMemoryVaultStore();
    const p = pending({}); // runAt Jan 5, horizon 7 → target date Jan 12
    await savePredictions(store, "AAPL", [p], 7);

    // Sparse history (< 15 bars) → ATR unknown → band falls back to ±1%.
    const bars = [bar("2026-01-09", 101), bar("2026-01-12", 106), bar("2026-01-13", 90)];
    const result = await resolveEligiblePredictions(store, "AAPL", null, NOW_MS, undefined, bars);

    expect(result).toEqual({ resolved: 1, expired: 0 });
    const [resolved] = await loadPredictions(store, "AAPL", 7);
    expect(resolved.status).toBe("resolved");
    expect(resolved.priceAtResolution).toBe(106); // Jan 12 close — NOT the later Jan 13 crash
    expect(resolved.actualPct).toBe(6);
    expect(resolved.outcome).toBe("CORRECT");
    expect(resolved.flatBandPct).toBe(1);
    expect(resolved.catalystTypes).toEqual(["other"]); // no catalysts → fallback bucket
  });

  it("leaves predictions younger than their horizon untouched", async () => {
    const store = new InMemoryVaultStore();
    const p = pending({ runAt: NOW_MS - 4 * DAY_MS, horizonDays: 7 });
    await savePredictions(store, "AAPL", [p], 7);

    const result = await resolveEligiblePredictions(store, "AAPL", null, NOW_MS, undefined, [
      bar("2026-01-19", 120),
    ]);

    expect(result).toEqual({ resolved: 0, expired: 0 });
    const [still] = await loadPredictions(store, "AAPL", 7);
    expect(still.status).toBe("pending");
  });

  it("keeps a prediction pending when the horizon-date bar has not arrived yet", async () => {
    const store = new InMemoryVaultStore();
    // Horizon date Jan 18, but data lags — last bar is Jan 13. 2 days past
    // horizon is well inside the 30-day grace window.
    const p = pending({ runAt: NOW_MS - 9 * DAY_MS, horizonDays: 7 });
    await savePredictions(store, "AAPL", [p], 7);

    const result = await resolveEligiblePredictions(store, "AAPL", null, NOW_MS, undefined, [
      bar("2026-01-13", 101),
    ]);

    expect(result).toEqual({ resolved: 0, expired: 0 });
    const [still] = await loadPredictions(store, "AAPL", 7);
    expect(still.status).toBe("pending");
  });

  it("expires a long-overdue prediction with no resolvable data (no outcome, no calibration impact)", async () => {
    const store = new InMemoryVaultStore();
    const p = pending({ runAt: NOW_MS - (7 + 31) * DAY_MS, horizonDays: 7 });
    await savePredictions(store, "AAPL", [p], 7);

    const result = await resolveEligiblePredictions(store, "AAPL", null, NOW_MS, undefined, null);

    expect(result).toEqual({ resolved: 0, expired: 1 });
    const [expired] = await loadPredictions(store, "AAPL", 7);
    expect(expired.status).toBe("expired");
    expect(expired.outcome).toBeUndefined();
  });

  it("falls back to the live price (legacy path) when no bars are supplied", async () => {
    const store = new InMemoryVaultStore();
    const p = pending({}); // UP 5% from 100
    await savePredictions(store, "AAPL", [p], 7);

    const result = await resolveEligiblePredictions(store, "AAPL", 101.5, NOW_MS, undefined, null);

    expect(result).toEqual({ resolved: 1, expired: 0 });
    const [resolved] = await loadPredictions(store, "AAPL", 7);
    // +1.5% clears the legacy ±1% band (direction hit) but undershoots 2.5%.
    expect(resolved.outcome).toBe("PARTIAL");
    expect(resolved.priceAtResolution).toBe(101.5);
  });

  it("only touches the requested horizon when one is specified", async () => {
    const store = new InMemoryVaultStore();
    await savePredictions(store, "AAPL", [pending({ horizonDays: 7 })], 7);
    // 30d prediction already past its horizon — would resolve if not filtered out.
    await savePredictions(store, "AAPL", [pending({ horizonDays: 30, runAt: NOW_MS - 31 * DAY_MS })], 30);

    const result = await resolveEligiblePredictions(store, "AAPL", 106, NOW_MS, 7, null);

    expect(result.resolved).toBe(1);
    const [thirtyDay] = await loadPredictions(store, "AAPL", 30);
    expect(thirtyDay.status).toBe("pending");
  });
});
