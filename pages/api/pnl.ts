import type { NextApiRequest, NextApiResponse } from "next";
import { getTransactions } from "@/lib/etrade";
import { MOCK_TRANSACTIONS, compute2026PnL, computeUnrealizedPnL } from "@/lib/pnl";
import type { PnLResult } from "@/lib/pnl";
import { getServices } from "@/src/registry";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PnLResult | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { portfolioService } = getServices();
  const positions = await portfolioService.getPositionsSafe(false);

  const isMock = process.env.ETRADE_ENV === "mock";
  const hasTokens =
    !!process.env.ETRADE_OAUTH_TOKEN && !!process.env.ETRADE_OAUTH_TOKEN_SECRET;

  if (isMock || !hasTokens) {
    return res.status(200).json(compute2026PnL(MOCK_TRANSACTIONS, positions));
  }

  // Try to fetch transaction history for FIFO realized P&L.
  // E*TRADE's transactions API is not available on all account types — fall
  // back to unrealized-only if it errors.
  try {
    const [txn2026, txnPrior] = await Promise.all([
      getTransactions("01-01-2026", "12-31-2026"),
      getTransactions("01-01-2024", "12-31-2025"),
    ]);
    return res.status(200).json(compute2026PnL([...txnPrior, ...txn2026], positions));
  } catch (err) {
    console.warn("[/api/pnl] Transactions API unavailable, using unrealized P&L only:", (err as Error).message);
    const unrealizedPnL = computeUnrealizedPnL(positions);
    return res.status(200).json({ realizedPnL: 0, unrealizedPnL, totalPnL: unrealizedPnL });
  }
}
