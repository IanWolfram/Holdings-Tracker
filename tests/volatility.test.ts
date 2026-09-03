import { describe, expect, it } from "vitest";
import {
  findBarOnOrBefore,
  findBarOnOrAfter,
  atrPercentAsOf,
  flatBandPct,
  flatBandFromBars,
  FLAT_BAND_FLOOR_PCT,
  FLAT_BAND_CEIL_PCT,
  FLAT_BAND_ATR_MULTIPLIER,
} from "@/lib/marketdata/volatility";
import type { DailyBar } from "@/lib/marketdata/prices";

function bar(date: string, close: number, high = close, low = close): DailyBar {
  return { date, open: close, high, low, close, volume: 1000 };
}

describe("bar lookup helpers", () => {
  const bars = [bar("2026-01-05", 100), bar("2026-01-08", 101), bar("2026-01-12", 106)];

  it("findBarOnOrBefore returns the latest bar at or before the target date", () => {
    expect(findBarOnOrBefore(bars, "2026-01-10")?.date).toBe("2026-01-08");
    expect(findBarOnOrBefore(bars, "2026-01-08")?.date).toBe("2026-01-08"); // inclusive
    expect(findBarOnOrBefore(bars, "2026-01-01")).toBeNull(); // before all bars
  });

  it("findBarOnOrAfter returns the earliest bar at or after the target date", () => {
    expect(findBarOnOrAfter(bars, "2026-01-09")?.date).toBe("2026-01-12");
    expect(findBarOnOrAfter(bars, "2026-01-12")?.date).toBe("2026-01-12"); // inclusive
    expect(findBarOnOrAfter(bars, "2026-01-20")).toBeNull(); // after all bars
  });
});

describe("flatBandPct", () => {
  it("falls back to the floor when volatility is unknown or degenerate", () => {
    expect(flatBandPct(null, 7)).toBe(FLAT_BAND_FLOOR_PCT);
    expect(flatBandPct(NaN, 7)).toBe(FLAT_BAND_FLOOR_PCT);
    expect(flatBandPct(0, 7)).toBe(FLAT_BAND_FLOOR_PCT);
    expect(flatBandPct(-3, 7)).toBe(FLAT_BAND_FLOOR_PCT);
  });

  it("scales the daily ATR% by sqrt(horizon)", () => {
    // 2% daily ATR, 4-day horizon → 0.75 * 2 * sqrt(4) = 3.0%
    expect(flatBandPct(2, 4)).toBeCloseTo(FLAT_BAND_ATR_MULTIPLIER * 2 * 2, 6);
    // 1-day horizon → 0.75 * 4 * 1 = 3.0%
    expect(flatBandPct(4, 1)).toBeCloseTo(3.0, 6);
  });

  it("never tightens below the floor", () => {
    // 0.5% ATR over 1 day → 0.375%, clamped up to the 1% floor.
    expect(flatBandPct(0.5, 1)).toBe(FLAT_BAND_FLOOR_PCT);
  });

  it("never widens beyond the ceiling", () => {
    // Absurd 50% ATR over 30 days would be enormous → clamped to ceiling.
    expect(flatBandPct(50, 30)).toBe(FLAT_BAND_CEIL_PCT);
  });

  it("treats horizon < 1 as 1 day", () => {
    expect(flatBandPct(4, 0)).toBeCloseTo(flatBandPct(4, 1), 6);
  });
});

describe("atrPercentAsOf", () => {
  it("returns null without enough history before the date", () => {
    const few = [bar("2026-01-05", 100), bar("2026-01-06", 101)];
    expect(atrPercentAsOf(few, "2026-01-06")).toBeNull();
  });

  it("measures volatility as of the given date, ignoring later bars", () => {
    // 30 calm bars (~1% range) then a later huge spike. As of the calm date,
    // ATR% should be small and unaffected by the future spike.
    const calm: DailyBar[] = [];
    for (let i = 1; i <= 30; i++) {
      const d = `2026-02-${String(i).padStart(2, "0")}`;
      calm.push(bar(d, 100, 100.5, 99.5));
    }
    const spike = bar("2026-03-15", 100, 180, 60);
    const asOfCalm = atrPercentAsOf([...calm, spike], "2026-02-28");
    expect(asOfCalm).not.toBeNull();
    expect(asOfCalm!).toBeGreaterThan(0);
    expect(asOfCalm!).toBeLessThan(3); // calm regime, spike excluded
  });
});

describe("flatBandFromBars", () => {
  it("falls back to the floor when history is too short to size a band", () => {
    const bars = [bar("2026-01-05", 100), bar("2026-01-06", 101)];
    expect(flatBandFromBars(bars, "2026-01-06", 7)).toBe(FLAT_BAND_FLOOR_PCT);
  });
});
