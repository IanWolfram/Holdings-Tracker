import type { Position } from "@/types/position.types";

export function mapRawPosition(pos: {
  Product?: { symbol?: string };
  symbolDescription?: string;
  quantity?: string | number;
  marketValue?: string | number;
  totalGain?: string | number;
  pricePaid?: string | number;
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
    dayChange: Number(pos.Quick?.change ?? 0),
    dayChangePct: Number(pos.Quick?.changePct ?? 0),
  };
}

// Seeded PRNG so synthetic charts are stable across requests for the same ticker
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function tickerSeed(ticker: string): number {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (Math.imul(31, h) + ticker.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function withSyntheticHistory(positions: Position[]): Position[] {
  return positions.map((pos) => {
    if (pos.history && pos.history.length > 0) return pos;

    const rand = seededRand(tickerSeed(pos.ticker));
    const points = 90;
    const history: number[] = [];
    const current = pos.currentPrice;
    const startingVal = current - pos.gainLoss / pos.quantity;
    let val = startingVal;

    for (let i = 0; i < points - 1; i++) {
      history.push(val);
      const trend = (current - val) / (points - i);
      const noise = (rand() - 0.5) * (current * 0.015);
      const ridges = Math.sin(i * 0.5) * (current * 0.005);
      val += trend + noise + ridges;
    }
    history.push(current);

    return { ...pos, history };
  });
}
