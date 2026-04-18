import type { ETradeTransaction } from "./etrade";
import type { Position } from "@/types/position.types";

export interface PnLResult {
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
}

// Mock 2026 transaction history: some pre-2026 buys (cost basis) + 2026 activity
export const MOCK_TRANSACTIONS: ETradeTransaction[] = [
  // Pre-2026 buys — establish cost basis for current positions
  { transactionId: "t001", transactionDate: new Date("2025-03-10").getTime(), transactionType: "Bought", amount: -2655, ticker: "BR",   quantity: 15, price: 177.00, fee: 0 },
  { transactionId: "t002", transactionDate: new Date("2025-04-15").getTime(), transactionType: "Bought", amount: -1950, ticker: "MSFT",  quantity: 5,  price: 390.00, fee: 0 },
  { transactionId: "t003", transactionDate: new Date("2025-05-20").getTime(), transactionType: "Bought", amount: -1700, ticker: "AAPL",  quantity: 10, price: 170.00, fee: 0 },
  { transactionId: "t004", transactionDate: new Date("2025-06-01").getTime(), transactionType: "Bought", amount: -2400, ticker: "NVDA",  quantity: 4,  price: 600.00, fee: 0 },
  { transactionId: "t005", transactionDate: new Date("2025-07-14").getTime(), transactionType: "Bought", amount: -2160, ticker: "JPM",   quantity: 12, price: 180.00, fee: 0 },
  { transactionId: "t006", transactionDate: new Date("2025-08-03").getTime(), transactionType: "Bought", amount: -2000, ticker: "RBL",   quantity: 50, price: 40.00,  fee: 0 },
  { transactionId: "t007", transactionDate: new Date("2025-09-22").getTime(), transactionType: "Bought", amount: -1600, ticker: "TM",    quantity: 8,  price: 200.00, fee: 0 },
  { transactionId: "t008", transactionDate: new Date("2025-10-05").getTime(), transactionType: "Bought", amount: -960,  ticker: "INFY",  quantity: 60, price: 16.00,  fee: 0 },
  { transactionId: "t009", transactionDate: new Date("2025-11-18").getTime(), transactionType: "Bought", amount: -600,  ticker: "005930",quantity: 10, price: 60.00,  fee: 0 },

  // 2026 — closed trades (realized P&L)
  { transactionId: "t010", transactionDate: new Date("2026-01-08").getTime(), transactionType: "Bought", amount: -1500, ticker: "TSLA",  quantity: 5,  price: 300.00, fee: 0 },
  { transactionId: "t011", transactionDate: new Date("2026-01-22").getTime(), transactionType: "Bought", amount: -600,  ticker: "AMZN",  quantity: 3,  price: 200.00, fee: 0 },
  { transactionId: "t012", transactionDate: new Date("2026-02-14").getTime(), transactionType: "Sold",   amount: 1900,  ticker: "TSLA",  quantity: 5,  price: 380.00, fee: 0 },
  { transactionId: "t013", transactionDate: new Date("2026-03-03").getTime(), transactionType: "Sold",   amount: 555,   ticker: "AMZN",  quantity: 3,  price: 185.00, fee: 0 },
];

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
