import { NextApiRequest, NextApiResponse } from "next";
import { getPositions } from "@/lib/etrade";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const hasTokens = !!process.env.ETRADE_OAUTH_TOKEN && !!process.env.ETRADE_OAUTH_TOKEN_SECRET;

  if (!hasTokens || process.env.ETRADE_ENV === "mock") {
    res.status(200).json({
      connected: false,
      env: process.env.ETRADE_ENV || "live"
    });
    return;
  }

  try {
    await getPositions();
    res.status(200).json({
      connected: true,
      env: process.env.ETRADE_ENV || "live"
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const tokenExpired = msg.includes("401") || msg.includes("403");
    res.status(200).json({
      connected: false,
      tokenExpired,
      env: process.env.ETRADE_ENV || "live"
    });
  }
}
