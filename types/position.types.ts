export interface Position {
  ticker: string;
  description: string;
  quantity: number;
  marketValue: number;
  gainLoss: number;
  pricePaid: number;
  currentPrice: number;
  history?: number[];
  purchaseDate?: number; // epoch timestamp in ms
  dayChange?: number;    // dollar change today per share (from E*TRADE Quick.change)
  dayChangePct?: number; // percent change today (from E*TRADE Quick.changePct)
  isProposed?: boolean;   // marks this as a watchlist/proposed position (not yet bought)
  targetShares?: number;   // optional: shares user plans to buy
  targetPrice?: number;    // optional: target buy price
  addedAt?: number;        // epoch ms when added to proposed positions
}
