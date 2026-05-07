import { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { loadUserTokens } from "@/lib/etrade/tokens";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // In single-user mode, use the legacy env-var check
  if (process.env.PULSE_SINGLE_USER_MODE === "1") {
    const hasTokens = !!process.env.ETRADE_OAUTH_TOKEN && !!process.env.ETRADE_OAUTH_TOKEN_SECRET;

    if (!hasTokens || process.env.ETRADE_ENV === "mock") {
      return res.status(200).json({
        connected: false,
        env: process.env.ETRADE_ENV || "live",
      });
    }

    // Check if tokens are likely expired (past midnight ET)
    // In single-user mode we can't check the actual expiry since it's in .env.local
    return res.status(200).json({
      connected: true,
      env: process.env.ETRADE_ENV || "live",
    });
  }

  // Multi-tenant: check Supabase-stored tokens
  const user = await requireUser(req, res);
  if (!user) return;

  const tokens = await loadUserTokens(user.id);

  if (!tokens) {
    return res.status(200).json({
      connected: false,
      env: process.env.ETRADE_ENV || "live",
    });
  }

  // Check if tokens are expired
  const tokenExpired = tokens.expiresAt ? new Date(tokens.expiresAt) < new Date() : false;

  res.status(200).json({
    connected: !tokenExpired,
    tokenExpired,
    env: tokens.env,
    expiresAt: tokens.expiresAt,
  });
}