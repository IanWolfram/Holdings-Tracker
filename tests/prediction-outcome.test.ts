import { describe, expect, it } from "vitest";
import { computePredictionOutcome } from "@/world-brain/predictions";
import { FLAT_BAND_PCT } from "@/types/predictions";

describe("computePredictionOutcome", () => {
  it("scores a direction hit with sufficient magnitude as CORRECT", () => {
    // predicted UP 5%, actual +6% — direction right, |actual| >= 5 * 0.5
    expect(computePredictionOutcome("UP", 5, 6, FLAT_BAND_PCT)).toBe("CORRECT");
    expect(computePredictionOutcome("DOWN", 4, -3, FLAT_BAND_PCT)).toBe("CORRECT");
  });

  it("scores a direction hit that undershoots magnitude as PARTIAL", () => {
    // +1.5% clears the 1% flat band (so effective direction is UP) but is
    // under the 5 * 0.5 = 2.5% magnitude threshold.
    expect(computePredictionOutcome("UP", 5, 1.5, FLAT_BAND_PCT)).toBe("PARTIAL");
  });

  it("treats a move inside the flat band as FLAT (missing a directional call)", () => {
    expect(computePredictionOutcome("UP", 5, 0.5, FLAT_BAND_PCT)).toBe("INCORRECT");
    // A FLAT prediction with a within-band move is a hit.
    expect(computePredictionOutcome("FLAT", 0, 0.5, FLAT_BAND_PCT)).toBe("CORRECT");
  });

  it("scores the wrong direction as INCORRECT", () => {
    expect(computePredictionOutcome("UP", 5, -6, FLAT_BAND_PCT)).toBe("INCORRECT");
  });

  it("respects a widened volatility band — a 2% move on a 3%-band name is noise", () => {
    expect(computePredictionOutcome("UP", 5, 2, 3)).toBe("INCORRECT");
    expect(computePredictionOutcome("FLAT", 0, 2, 3)).toBe("CORRECT");
  });

  it("exactly-at-band moves count as FLAT (band is inclusive)", () => {
    expect(computePredictionOutcome("FLAT", 0, 1.0, FLAT_BAND_PCT)).toBe("CORRECT");
    expect(computePredictionOutcome("UP", 5, 1.0, FLAT_BAND_PCT)).toBe("INCORRECT");
  });
});
