import { describe, expect, it, vi } from "vitest";
import { parsePredictions } from "@/types/predictions";
import { loadPredictions, savePredictions } from "@/world-brain/predictions";
import type { TickerPrediction } from "@/types/predictions";
import { InMemoryVaultStore } from "./helpers/InMemoryVaultStore";

function valid(overrides: Partial<TickerPrediction> = {}): TickerPrediction {
  return {
    id: "p1",
    ticker: "AAPL",
    runAt: 1_700_000_000_000,
    priceAtPrediction: 100,
    direction: "UP",
    magnitudePct: 5,
    horizonDays: 7,
    confidence: 0.7,
    reasoning: "test",
    catalysts: [],
    engine: "v4",
    status: "pending",
    ...overrides,
  };
}

describe("parsePredictions", () => {
  it("keeps valid rows and drops corrupt ones", () => {
    const raw = [
      valid({ id: "ok1" }),
      { ...valid(), priceAtPrediction: NaN }, // non-finite price
      { ...valid(), direction: "SIDEWAYS" }, // bad enum
      { ...valid(), id: "" }, // empty id
      { ...valid(), status: "resolved", outcome: "CORRECT", id: "ok2" },
      "not an object",
      null,
    ];
    const { predictions, dropped } = parsePredictions(raw);
    expect(predictions.map((p) => p.id)).toEqual(["ok1", "ok2"]);
    expect(dropped).toBe(5);
  });

  it("defaults missing non-critical fields rather than dropping the row", () => {
    const { predictions, dropped } = parsePredictions([
      { id: "x", ticker: "MSFT", runAt: 1, priceAtPrediction: 10, direction: "FLAT", magnitudePct: 0, horizonDays: 1, confidence: 0.5, status: "pending" },
    ]);
    expect(dropped).toBe(0);
    expect(predictions[0].catalysts).toEqual([]);
    expect(predictions[0].engine).toBe("unknown");
    expect(predictions[0].reasoning).toBe("");
  });

  it("preserves unknown/newer fields via passthrough", () => {
    const { predictions } = parsePredictions([{ ...valid(), futureField: 42 }]);
    expect((predictions[0] as unknown as Record<string, unknown>).futureField).toBe(42);
  });

  it("returns empty for non-array input", () => {
    expect(parsePredictions({})).toEqual({ predictions: [], dropped: 0 });
    expect(parsePredictions(null)).toEqual({ predictions: [], dropped: 0 });
  });
});

describe("loadPredictions validation integration", () => {
  it("filters corrupt rows out of a stored prediction file", async () => {
    const store = new InMemoryVaultStore();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Write a file mixing a valid and a corrupt row (bypass savePredictions).
    await store.write(
      "predictions/AAPL-7d.json",
      JSON.stringify([valid({ id: "good" }), { ...valid(), priceAtPrediction: null }])
    );

    const loaded = await loadPredictions(store, "AAPL", 7);
    expect(loaded.map((p) => p.id)).toEqual(["good"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("round-trips clean predictions untouched", async () => {
    const store = new InMemoryVaultStore();
    await savePredictions(store, "AAPL", [valid({ id: "a" }), valid({ id: "b" })], 7);
    const loaded = await loadPredictions(store, "AAPL", 7);
    expect(loaded.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
