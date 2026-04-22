
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const hasTokens = !!process.env.ETRADE_OAUTH_TOKEN && !!process.env.ETRADE_OAUTH_TOKEN_SECRET;
  
  // We could also attempt a tiny API call here to verify they aren't expired,
  // but just checking for existence is a good start.
  
  res.status(200).json({ 
    connected: hasTokens,
    env: process.env.ETRADE_ENV || "live"
  });
}
