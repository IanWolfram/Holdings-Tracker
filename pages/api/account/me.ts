import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const services = await getServicesForUser(user.id);

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
      env: process.env.ETRADE_ENV ?? "live",
      expiresAt: etradeExpiry.expiresAt,
    },
  });
}, "api/account/me");