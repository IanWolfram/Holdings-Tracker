import type { ETradeTransaction } from "./etrade";
import type { Position } from "@/types/position.types";

export interface PnLResult {
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
}

interface LotEntry {
  quantity: number;
  price: number;
}

/**
 * FIFO cost-basis matching.
 * Processes all transactions chronologically, maintains buy lots per ticker,
 * and computes realized P&L for each sell.
 */
export function computeRealizedPnL(
  transactions: ETradeTransaction[],
  sinceMs: number // only count sells on or after this timestamp
): number {
  const lots = new Map<string, LotEntry[]>();
  let realized = 0;

  const sorted = [...transactions].sort((a, b) => a.transactionDate - b.transactionDate);

  for (const tx of sorted) {
    const ticker = tx.ticker;
    if (!ticker || !tx.quantity || !tx.price) continue;

    if (tx.transactionType === "Bought") {
      if (!lots.has(ticker)) lots.set(ticker, []);
      lots.get(ticker)!.push({ quantity: tx.quantity, price: tx.price });
    } else if (tx.transactionType === "Sold" && tx.transactionDate >= sinceMs) {
      const queue = lots.get(ticker) ?? [];
      let remainingToSell = tx.quantity;
      let costBasis = 0;

      while (remainingToSell > 0 && queue.length > 0) {
        const lot = queue[0];
        const filled = Math.min(lot.quantity, remainingToSell);
        costBasis += filled * lot.price;
        lot.quantity -= filled;
        remainingToSell -= filled;
        if (lot.quantity === 0) queue.shift();
      }

      const proceeds = tx.quantity * tx.price - (tx.fee ?? 0);
      realized += proceeds - costBasis;
    }
  }

  return realized;
}

/** Sum unrealized P&L from current open positions */
export function computeUnrealizedPnL(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + p.gainLoss, 0);
}

export function compute2026PnL(
  transactions: ETradeTransaction[],
  positions: Position[]
): PnLResult {
  const jan1 = new Date("2026-01-01").getTime();
  const realizedPnL = computeRealizedPnL(transactions, jan1);
  const unrealizedPnL = computeUnrealizedPnL(positions);
  return { realizedPnL, unrealizedPnL, totalPnL: realizedPnL + unrealizedPnL };
}
