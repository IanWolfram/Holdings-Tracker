import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";
import { getSnapTradeClient, isSnapTradeConfigured } from "@/lib/snaptrade/client";
import { loadSnapTradeUser } from "@/lib/snaptrade/users";

interface AuthLike {
  id?: string;
  disabled?: boolean | null;
  brokerage?: {
    name?: string | null;
    slug?: string | null;
    display_name?: string | null;
    aws_s3_square_logo_url?: string | null;
    aws_s3_logo_url?: string | null;
  } | null;
}
interface AccountLike {
  id?: string;
  name?: string | null;
  number?: string | null;
  brokerage_authorization?: string;
  raw_type?: string | null;
  meta?: { institutionType?: string | null } | null;
  balance?: { total?: { amount?: number | null } | null } | null;
}

/**
 * SnapTrade connection state, organized by brokerage authorization (so bank-only
 * connections like PNC that expose no investment account still appear), with each
 * authorization's accounts and total balance attached.
 */
export default apiHandler(["GET"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  if (!isSnapTradeConfigured()) {
    return res.status(200).json({ configured: false, registered: false, connected: false, connections: [] });
  }

  const stUser = await loadSnapTradeUser(user.id);
  if (!stUser) {
    return res.status(200).json({ configured: true, registered: false, connected: false, connections: [] });
  }

  const client = getSnapTradeClient();
  const [authsRes, acctsRes] = await Promise.all([
    client.connections.listBrokerageAuthorizations({ userId: stUser.snapTradeUserId, userSecret: stUser.userSecret }),
    client.accountInformation.listUserAccounts({ userId: stUser.snapTradeUserId, userSecret: stUser.userSecret }),
  ]);

  const accounts = (acctsRes.data ?? []) as AccountLike[];
  const connections = ((authsRes.data ?? []) as AuthLike[]).map((a) => {
    const own = accounts.filter((ac) => ac.brokerage_authorization === a.id);
    return {
      id: a.id,
      name: a.brokerage?.display_name ?? a.brokerage?.name ?? "Brokerage",
      slug: a.brokerage?.slug ?? null,
      logo: a.brokerage?.aws_s3_square_logo_url ?? a.brokerage?.aws_s3_logo_url ?? null,
      disabled: !!a.disabled,
      accounts: own.map((ac) => ({
        id: ac.id,
        name: ac.name ?? null,
        number: ac.number ?? null,
        type: ac.meta?.institutionType ?? ac.raw_type ?? null,
        balance: ac.balance?.total?.amount ?? null,
      })),
      totalBalance: own.length ? own.reduce((s, ac) => s + (ac.balance?.total?.amount ?? 0), 0) : null,
    };
  });

  return res.status(200).json({
    configured: true,
    registered: true,
    connected: connections.length > 0,
    connections,
  });
}, "api/snaptrade/status");
