import type { NextApiRequest, NextApiResponse } from "next";
import { getCashBalance } from "@/lib/etrade";

const MOCK_CASH = 2_847.32;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ cashBalance: number } | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const isMock = process.env.ETRADE_ENV === "mock";
    const hasTokens =
      !!process.env.ETRADE_OAUTH_TOKEN && !!process.env.ETRADE_OAUTH_TOKEN_SECRET;

    if (isMock || !hasTokens) {
      return res.status(200).json({ cashBalance: MOCK_CASH });
    }

    const cashBalance = await getCashBalance();
    res.status(200).json({ cashBalance });
  } catch (err) {
    console.error("[/api/balance]", err);
    res.status(200).json({ cashBalance: 0 });
  }
}
