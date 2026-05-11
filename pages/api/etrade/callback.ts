import { NextApiRequest, NextApiResponse } from "next";
import { getAccessToken } from "@/lib/etrade";
import { requireUser } from "@/lib/auth/requireUser";
import { consumeRequestToken, saveUserTokens } from "@/lib/etrade/tokens";
import { invalidateUserServices } from "@/src/registry";

const OAUTH_PARAM = /^[A-Za-z0-9._~-]{1,256}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const oauthVerifier =
    typeof req.body?.oauth_verifier === "string" ? req.body.oauth_verifier.trim() : "";

  if (!oauthVerifier || !OAUTH_PARAM.test(oauthVerifier)) {
    return res.status(400).json({ error: "Invalid or missing verification code." });
  }

  const pending = await consumeRequestToken(user.id);
  if (!pending) {
    return res.status(400).json({
      error: "Authorization session expired. Please start the connection flow again.",
    });
  }

  try {
    const { token, tokenSecret } = await getAccessToken(
      pending.requestToken,
      pending.requestSecret,
      oauthVerifier,
    );

    const env = (process.env.ETRADE_ENV === "sandbox" ? "sandbox" : "live") as "live" | "sandbox";

    // E*TRADE tokens expire at midnight ET on weekdays
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 1);
    expiry.setHours(0, 0, 0, 0);

    await saveUserTokens(user.id, token, tokenSecret, {
      env,
      expiresAt: expiry.toISOString(),
    });

    // Force the next request to rebuild the ETradeProvider with the new tokens.
    invalidateUserServices(user.id);

    return res.status(200).json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[etrade-callback] Error exchanging token:", msg);
    return res.status(500).json({ error: msg });
  }
}
