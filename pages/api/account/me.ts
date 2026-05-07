import { NextApiRequest, NextApiResponse } from "next";
import { requireUser, isDevUser } from "@/lib/auth/requireUser";
import { getServicesForUser, getServices } from "@/src/registry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const services = isDevUser(user) ? getServices() : await getServicesForUser(user.id);

  const [account, preferences, etradeExpiry] = await Promise.all([
    services.accountInfo.getAccountInfo(user.id),
    services.accountInfo.getPreferences(user.id),
    services.accountInfo.getEtradeTokenExpiry(user.id),
  ]);

  return res.status(200).json({
    account: {
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      createdAt: account.createdAt,
      lastSignInAt: account.lastSignInAt,
    },
    preferences: {
      cronOptIn: preferences.cronOptIn,
      aiModel: preferences.aiModel,
      vaultEnabled: preferences.vaultEnabled,
    },
    etrade: {
      env: process.env.ETRADE_ENV ?? "mock",
      expiresAt: etradeExpiry.expiresAt,
    },
  });
}