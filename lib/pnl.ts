import type { Position } from "@/types/position.types";

export interface PnLResult {
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
}

/** Sum unrealized P&L from current open positions */
export function computeUnrealizedPnL(positions: Position[]): number {
  return positions.reduce((sum, p) => sum + p.gainLoss, 0);
}