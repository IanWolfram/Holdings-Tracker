import { describe, expect, it } from "vitest";
import { updateCalibration } from "@/world-brain/calibration";
import type { TickerPrediction } from "@/types/predictions";
import { InMemoryVaultStore } from "./helpers/InMemoryVaultStore";

function resolved(overrides: Partial<TickerPrediction>): TickerPrediction {
  return {
    id: `p-${Math.random().toString(36).slice(2)}`,
    ticker: "AAPL",
    runAt: Date.parse("2026-01-05T15:00:00.000Z"),
    priceAtPrediction: 100,
    direction: "UP",
    magnitudePct: 5,
    horizonDays: 7,
    confidence: 0.6,
    rawConfidence: 0.8,
    reasoning: "test",
    catalysts: [],
    engine: "test-engine",
    status: "resolved",
    resolvedAt: Date.parse("2026-01-12T21:00:00.000Z"),
    priceAtResolution: 106,
    actualPct: 6,
    outcome: "CORRECT",
    ...overrides,
  };
}

describe("updateCalibration", () => {
  it("aggregates resolved predictions and writes _metrics/calibration.json", async () => {
    const store = new InMemoryVaultStore();
    await store.write(
      "predictions/AAPL-7d.json",
      JSON.stringify([
        resolved({ outcome: "CORRECT" }),
        resolved({ outcome: "INCORRECT", direction: "DOWN" }),
        resolved({ status: "pending", outcome: undefined }), // pending → excluded
      ])
    );
    await store.write(
      "predictions/MSFT-30d.json",
      JSON.stringify([resolved({ ticker: "MSFT", horizonDays: 30, outcome: "PARTIAL", catalystTypes: ["earnings-beat"] })])
    );

    const report = await updateCalibration(store);

    expect(report.totalResolved).toBe(3);
    expect(report.byTicker.AAPL).toMatchObject({ n: 2, correct: 1, incorrect: 1, winRate: 0.5 });
    expect(report.byTicker.MSFT).toMatchObject({ n: 1, partial: 1 });
    expect(report.byHorizon["7d"].n).toBe(2);
    expect(report.byHorizon["30d"].n).toBe(1);
    expect(report.byCatalyst["earnings-beat"].n).toBe(1);
    expect(report.byCatalyst.other.n).toBe(2); // no catalysts → "other" bucket

    const written = await store.read("_metrics/calibration.json");
    expect(written).not.toBeNull();
    expect(JSON.parse(written!).totalResolved).toBe(3);
  });

  it("buckets by STATED (raw) confidence so the shrink feedback loop closes", async () => {
    const store = new InMemoryVaultStore();
    // Shown confidence 0.55 after shrink, but the model *stated* 0.85 —
    // the outcome must land in the 0.8–0.9 bucket, not 0.5–0.6.
    await store.write(
      "predictions/AAPL-7d.json",
      JSON.stringify([resolved({ confidence: 0.55, rawConfidence: 0.85 })])
    );

    const report = await updateCalibration(store);

    expect(report.byConfidenceBucket["0.8-0.9"]).toMatchObject({ n: 1, avgConfidence: 0.85 });
    expect(report.byConfidenceBucket["0.5-0.6"]).toBeUndefined();
  });

  it("excludes shadow predictions from live calibration", async () => {
    const store = new InMemoryVaultStore();
    await store.write(
      "predictions/AAPL-7d.json",
      JSON.stringify([resolved({}), resolved({ shadow: true })])
    );

    const report = await updateCalibration(store);
    expect(report.totalResolved).toBe(1);
  });

  it("skips malformed prediction files without failing the whole update", async () => {
    const store = new InMemoryVaultStore();
    await store.write("predictions/BAD-7d.json", "{not json");
    await store.write("predictions/AAPL-7d.json", JSON.stringify([resolved({})]));

    const report = await updateCalibration(store);
    expect(report.totalResolved).toBe(1);
  });
});
