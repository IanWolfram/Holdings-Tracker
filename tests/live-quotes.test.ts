import { describe, expect, it } from "vitest";
import { applyLiveQuote, applyLiveQuotes } from "@/lib/live-quotes";
import type { Position } from "@/types/position.types";
import type { QuoteData } from "@/types/market-data.types";

// Stale brokerage snapshot: 5 shares bought at $144.47, last synced at $167.23.
const position: Position = {
  ticker: "PLTR",
  description: "Palantir",
  quantity: 5,
  pricePaid: 144.47,
  currentPrice: 167.23,
  marketValue: 836.15,
  gainLoss: 113.8,
};

function quote(overrides: Partial<QuoteData> = {}): QuoteData {
  return {
    ticker: "PLTR",
    currentPrice: 183.76,
    changePercent: -6.45,
    dayHigh: 193.92,
    dayLow: 180.81,
    previousClose: 196.42,
    source: "finnhub",
    fetchedAt: 0,
    ...overrides,
  };
}

describe("applyLiveQuote", () => {
  it("reprices market value and P/L from the live price, keeping quantity and cost basis", () => {
    const p = applyLiveQuote(position, quote());
    expect(p.currentPrice).toBe(183.76);
    expect(p.marketValue).toBeCloseTo(918.8, 2);
    expect(p.gainLoss).toBeCloseTo(918.8 - 722.35, 2);
    expect(p.quantity).toBe(5);
    expect(p.pricePaid).toBe(144.47);
  });

  it("derives today's change from the previous close", () => {
    const p = applyLiveQuote(position, quote());
    expect(p.dayChange).toBeCloseTo(-12.66, 2);
    expect(p.dayChangePct).toBeCloseTo(-6.445, 2);
  });

  it("leaves the position untouched when there is no usable quote", () => {
    expect(applyLiveQuote(position, undefined)).toBe(position);
    expect(applyLiveQuote(position, quote({ currentPrice: 0 }))).toBe(position);
  });

  it("shifts P/L by the value change when cost basis is unknown", () => {
    const p = applyLiveQuote({ ...position, pricePaid: 0 }, quote());
    expect(p.gainLoss).toBeCloseTo(113.8 + (918.8 - 836.15), 2);
  });

  it("skips today's change when the previous close is missing", () => {
    const p = applyLiveQuote(position, quote({ previousClose: 0 }));
    expect(p.dayChange).toBeUndefined();
    expect(p.dayChangePct).toBeUndefined();
  });
});

describe("applyLiveQuotes", () => {
  it("matches quotes by ticker and passes through tickers without one", () => {
    const other: Position = { ...position, ticker: "MMS" };
    const [pltr, mms] = applyLiveQuotes([position, other], { PLTR: quote() });
    expect(pltr.currentPrice).toBe(183.76);
    expect(mms).toBe(other);
  });
});
