import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";
import { deleteSnapTradeUser } from "@/lib/snaptrade/users";
import { invalidateUserServices } from "@/src/registry";

/**
 * Disconnect SnapTrade: deletes the user on SnapTrade's side (revoking all
 * brokerage connections) and removes our stored registration, then drops the
 * cached per-user services so the next request rebuilds without SnapTrade.
 */
export default apiHandler(["POST"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  await deleteSnapTradeUser(user.id);
  invalidateUserServices(user.id);

  return res.status(200).json({ ok: true });
}, "api/snaptrade/disconnect");
