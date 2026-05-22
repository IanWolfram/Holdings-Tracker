import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { buildConfig } from "@/src/config";
import { loadUserTokens } from "@/lib/etrade/tokens";
import { apiHandler } from "@/lib/api-handler";

export interface BrokerStatus {
  id: "etrade" | "schwab";
  label: string;
  logo: string;
  configured: boolean;
  connected: boolean;
  authorizedAt: string | null;
}

export interface BrokersStatusResponse {
  brokers: BrokerStatus[];
  mostRecent: BrokerStatus["id"] | null;
  lastUsed: BrokerStatus["id"] | null;
}

export default apiHandler(["GET"], async (req, res: NextApiResponse<BrokersStatusResponse | { error: string }>) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const cfg = buildConfig();

  const etrade = await loadUserTokens(user.id).catch(() => null);

  const etradeExpired = etrade?.expiresAt ? new Date(etrade.expiresAt) < new Date() : false;

  const brokers: BrokerStatus[] = [
    {
      id: "etrade",
      label: "E*TRADE",
      logo: "/etrade-logo.png",
      configured: !!cfg.etrade.consumerKey || !!cfg.etrade.oauthToken,
      connected: !!etrade && !etradeExpired,
      authorizedAt: etrade?.authorizedAt ?? null,
    },
  ];

  // Most-recently-authorized connected broker drives the primary logo in the UI.
  const mostRecent =
    brokers
      .filter((b) => b.connected && b.authorizedAt)
      .sort((a, b) => new Date(b.authorizedAt!).getTime() - new Date(a.authorizedAt!).getTime())[0]?.id ??
    null;

  // Most-recently-authorized broker regardless of current connection state.
  // The token row (and its authorized_at) survives daily expiry, so this lets
  // the UI remember the last brokerage for quick re-authentication.
  const lastUsed =
    brokers
      .filter((b) => b.authorizedAt)
      .sort((a, b) => new Date(b.authorizedAt!).getTime() - new Date(a.authorizedAt!).getTime())[0]?.id ??
    null;

  res.status(200).json({ brokers, mostRecent, lastUsed });
}, "api/brokers/status");