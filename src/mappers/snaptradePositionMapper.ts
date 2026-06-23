import type { Position } from "@/types/position.types";

/**
 * Minimal structural shape of a SnapTrade `Position` (from getAllUserHoldings).
 * We type only the fields we consume to avoid coupling to the SDK's exported
 * model types. See snaptrade-typescript-sdk `Position` / `PositionSymbol` /
 * `UniversalSymbol`.
 */
export interface SnapTradePositionLike {
  symbol?: {
    description?: string | null;
    symbol?: {
      symbol?: string;
      raw_symbol?: string;
      description?: string | null;
    } | null;
  } | null;
  units?: number | null;
  fractional_units?: number | null;
  price?: number | null;
  open_pnl?: number | null;
  average_purchase_price?: number | null;
  cash_equivalent?: boolean | null;
}

/**
 * Map a SnapTrade position to the app's Position model. Returns null when the
 * symbol can't be resolved. SnapTrade does not provide intraday day-change or
 * lot acquisition dates here, so those fields are left unset.
 */
export function mapSnapTradePosition(p: SnapTradePositionLike): Position | null {
  const uni = p.symbol?.symbol;
  const ticker = uni?.symbol ?? uni?.raw_symbol;
  if (!ticker) return null;

  const quantity = Number(p.units ?? p.fractional_units ?? 0);
  const currentPrice = Number(p.price ?? 0);
  const pricePaid = Number(p.average_purchase_price ?? 0);

  return {
    ticker,
    description: uni?.description ?? p.symbol?.description ?? ticker,
    quantity,
    marketValue: quantity * currentPrice,
    gainLoss: Number(p.open_pnl ?? 0),
    pricePaid,
    currentPrice,
  };
}
