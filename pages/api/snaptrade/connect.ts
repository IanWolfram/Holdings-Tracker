import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";
import { isSnapTradeConfigured } from "@/lib/snaptrade/client";
import { getConnectionPortalUrl } from "@/lib/snaptrade/users";

/**
 * Returns a SnapTrade Connection Portal URL for the user to link a brokerage.
 * Registers the user with SnapTrade on first call. The client opens the
 * returned `redirectURI`; on completion SnapTrade redirects back and the
 * brokerage is connected.
 */
export default apiHandler(["POST"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  if (!isSnapTradeConfigured()) {
    return res.status(503).json({ error: "SnapTrade is not configured" });
  }

  const redirectURI = await getConnectionPortalUrl(user.id);
  return res.status(200).json({ redirectURI });
}, "api/snaptrade/connect");
