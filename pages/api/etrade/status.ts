import { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { loadUserTokens } from "@/lib/etrade/tokens";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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