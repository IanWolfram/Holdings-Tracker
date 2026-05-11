import { NextApiRequest, NextApiResponse } from "next";
import { getRequestToken } from "@/lib/etrade";
import { requireUser } from "@/lib/auth/requireUser";
import { saveRequestToken } from "@/lib/etrade/tokens";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
}
