import type { NextApiResponse } from "next";
import { getRequestToken } from "@/lib/etrade/oauth";
import { requireUser } from "@/lib/auth/requireUser";
import { saveRequestToken } from "@/lib/etrade/tokens";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    // E*TRADE app is registered as OOB-only — no redirect callback allowed.
    // User authorizes on E*TRADE, copies the verifier code, pastes it at /etrade-verify.
    const { token, tokenSecret, authUrl } = await getRequestToken("oob");

    await saveRequestToken(user.id, token, tokenSecret);

    return res.status(200).json({ authUrl });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[etrade-auth] Error starting auth:", msg);
    return res.status(500).json({ error: msg });
  }
}, "etrade-auth");
