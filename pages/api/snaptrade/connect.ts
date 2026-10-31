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
 *
 * Optional body `{ reconnect: <authorization id> }` opens the portal in repair
 * mode for a disabled connection. SnapTrade scopes the id to this user's
 * credentials, so another user's id simply fails.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default apiHandler(["POST"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  if (!isSnapTradeConfigured()) {
    return res.status(503).json({ error: "SnapTrade is not configured" });
  }

  const reconnect = (req.body as { reconnect?: unknown } | undefined)?.reconnect;
  if (reconnect !== undefined && (typeof reconnect !== "string" || !UUID_RE.test(reconnect))) {
    return res.status(400).json({ error: "Invalid connection id" });
  }

  const redirectURI = await getConnectionPortalUrl(user.id, { reconnect });
  return res.status(200).json({ redirectURI });
}, "api/snaptrade/connect");
