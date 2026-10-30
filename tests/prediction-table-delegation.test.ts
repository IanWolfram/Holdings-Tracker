import { describe, expect, it } from "vitest";
import {
  loadPredictions,
  savePredictions,
  appendPrediction,
  getAllPredictions,
  resolveEligiblePredictions,
} from "@/world-brain/predictions";
import type { TickerPrediction } from "@/types/predictions";
import type { DailyBar } from "@/lib/marketdata/prices";
import { InMemoryVaultStore } from "./helpers/InMemoryVaultStore";
import { InMemoryPredictionStore } from "./helpers/InMemoryPredictionStore";

const DAY = 86_400_000;
const NOW = Date.parse("2026-02-01T00:00:00.000Z");

function pending(overrides: Partial<TickerPrediction> = {}): TickerPrediction {
  return {
    id: `AAPL-7d-${Math.random().toString(36).slice(2)}`,
    ticker: "AAPL", runAt: NOW - 8 * DAY, priceAtPrediction: 100, direction: "UP",
    magnitudePct: 5, horizonDays: 7, confidence: 0.7, reasoning: "t", catalysts: [],
    engine: "e", status: "pending", ...overrides,
  };
}
const bar = (date: string, close: number): DailyBar => ({ date, open: close, high: close, low: close, close, volume: 1 });

describe("prediction functions delegate to a PredictionStore when present", () => {
  it("routes append/load/save through the table store, not the JSON vault", async () => {
    const table = new InMemoryPredictionStore();
    const store = new InMemoryVaultStore(table);

    await appendPrediction(store, pending({ id: "p1" }));
    expect(await loadPredictions(store, "AAPL", 7)).toHaveLength(1);

    // Nothing was written to the JSON vault path — proves delegation.
    expect(await store.read("predictions/AAPL-7d.json")).toBeNull();

    await savePredictions(store, "AAPL", [pending({ id: "p1" }), pending({ id: "p2" })], 7);
    expect(await loadPredictions(store, "AAPL", 7)).toHaveLength(2);
  });

  it("resolves through the table store (load→mutate→save round-trip)", async () => {
    const store = new InMemoryVaultStore(new InMemoryPredictionStore());
    await appendPrediction(store, pending({ id: "r1" }));

    const target = new Date(NOW - 8 * DAY + 7 * DAY).toISOString().slice(0, 10);
    const bars = [bar(new Date(NOW - 8 * DAY).toISOString().slice(0, 10), 100), bar(target, 106)];
    const res = await resolveEligiblePredictions(store, "AAPL", null, NOW, undefined, bars);

    expect(res).toEqual({ resolved: 1, expired: 0 });
    const [p] = await loadPredictions(store, "AAPL", 7);
    expect(p.status).toBe("resolved");
    expect(p.outcome).toBe("CORRECT");
    expect(p.priceAtResolution).toBe(106);
  });

  it("getAllPredictions groups the table store's rows by ticker", async () => {
    const store = new InMemoryVaultStore(new InMemoryPredictionStore());
    await appendPrediction(store, pending({ id: "a", ticker: "AAPL" }));
    await appendPrediction(store, pending({ id: "m", ticker: "MSFT", horizonDays: 30 }));

    const all = await getAllPredictions(store);
    expect(Object.keys(all).sort()).toEqual(["AAPL", "MSFT"]);
    expect(all.AAPL).toHaveLength(1);
  });

  it("without a PredictionStore, still uses the JSON vault path", async () => {
    const store = new InMemoryVaultStore(); // no table backend
    await appendPrediction(store, pending({ id: "j1" }));
    // JSON path writes an actual note.
    expect(await store.read("predictions/AAPL-7d.json")).not.toBeNull();
    expect(await loadPredictions(store, "AAPL", 7)).toHaveLength(1);
  });
});
