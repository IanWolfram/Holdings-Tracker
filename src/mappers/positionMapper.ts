import type { Position } from "@/types/position.types";

export function mapRawPosition(pos: {
  Product?: { symbol?: string };
  symbolDescription?: string;
  quantity?: string | number;
  marketValue?: string | number;
  totalGain?: string | number;
  pricePaid?: string | number;
  dateAcquired?: string | number;
  Quick?: { lastTrade?: string | number; change?: string | number; changePct?: string | number };
}): Position {
  return {
    ticker: (pos.Product?.symbol ?? "UNKNOWN") as string,
    description: (pos.symbolDescription ?? pos.Product?.symbol ?? "UNKNOWN") as string,
    quantity: Number(pos.quantity ?? 0),
    marketValue: Number(pos.marketValue ?? 0),
    gainLoss: Number(pos.totalGain ?? 0),
    pricePaid: Number(pos.pricePaid ?? 0),
    currentPrice: Number(pos.Quick?.lastTrade ?? 0),
    purchaseDate: normalizeAcquiredDate(pos.dateAcquired),
    dayChange: Number(pos.Quick?.change ?? 0),
    dayChangePct: Number(pos.Quick?.changePct ?? 0),
  };
}

// E*TRADE returns dateAcquired as an epoch (seconds or ms) when lot data is
// available, or a sentinel (≤0 / -1) when it isn't. Returns ms, or undefined.
function normalizeAcquiredDate(raw: string | number | undefined): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n < 1e12 ? n * 1000 : n; // seconds → ms
}
