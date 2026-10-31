import type { Position } from "@/types/position.types";
import type { QuoteData } from "@/types/market-data.types";

/**
 * Overlay a live market quote onto a brokerage position.
 *
 * Brokerage prices are only as fresh as the last SnapTrade sync. If a
 * connection breaks, they freeze, and P/L, portfolio value and the "today"
 * column silently go stale. A live quote fixes the price and supplies today's
 * change, which the brokerage feed doesn't carry.
 *
 * Quantity and cost basis always come from the brokerage. Only price-derived
 * fields change. A missing or zero quote leaves the position untouched.
 */
export function applyLiveQuote(position: Position, quote: QuoteData | undefined): Position {
  if (!quote || !(quote.currentPrice > 0)) return position;

  const price = quote.currentPrice;
  const marketValue = position.quantity * price;
  const gainLoss =
    position.pricePaid > 0
      ? marketValue - position.quantity * position.pricePaid
      : position.gainLoss + (marketValue - position.marketValue);

  return {
    ...position,
    currentPrice: price,
    marketValue,
    gainLoss,
    ...(quote.previousClose > 0
      ? {
          dayChange: price - quote.previousClose,
          dayChangePct: ((price - quote.previousClose) / quote.previousClose) * 100,
        }
      : {}),
  };
}

export function applyLiveQuotes(
  positions: Position[],
  quotes: Record<string, QuoteData>
): Position[] {
  return positions.map((p) => applyLiveQuote(p, quotes[p.ticker]));
}
