import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { loadUserTokens } from "@/lib/etrade/tokens";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET"], async (req, res: NextApiResponse) => {
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
}, "api/etrade/status");