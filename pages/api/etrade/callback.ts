import { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { consumeRequestToken, saveUserTokens } from "@/lib/etrade/tokens";
import { getAccessToken, updateEtradeTokens } from "@/lib/etrade";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Support both GET (callback redirect) and POST (oob verifier submission)
  const oauthToken = req.body?.oauth_token || req.query?.oauth_token;
  const oauthVerifier = req.body?.oauth_verifier || req.query?.oauth_verifier;

  if (!oauthVerifier) {
    return res.status(400).json({ error: "Missing oauth_verifier" });
  }

  // In single-user mode, use cookies for request token + secret
  if (process.env.PULSE_SINGLE_USER_MODE === "1") {
    const requestToken = req.cookies.etrade_request_token;
    const requestSecret = req.cookies.etrade_request_secret;
    if (!requestToken || !requestSecret) {
      return res.status(400).json({ error: "Session expired. Please start authentication again." });
    }

    try {
      const { token, tokenSecret } = await getAccessToken(
        requestToken,
        requestSecret,
        oauthVerifier as string,
      );

      await updateEtradeTokens(token, tokenSecret);
      res.setHeader("Set-Cookie", [
        "etrade_request_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        "etrade_request_secret=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      ]);

      if (req.method === "POST") {
        return res.status(200).json({ connected: true });
      }
      res.redirect("/?etrade_success=true");
    } catch (error) {
      console.error("[etrade-callback] Error in legacy callback:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (req.method === "POST") {
        return res.status(500).json({ error: `Authentication failed: ${msg}` });
      }
      res.status(500).send(`Authentication failed: ${msg}`);
    }
    return;
  }

  // Multi-tenant: authenticate user, look up request token from Supabase
  const user = await requireUser(req, res);
  if (!user) return;

  const requestToken = await consumeRequestToken(user.id);
  if (!requestToken) {
    return res.status(400).json({ error: "Session expired or invalid. Please start authentication again." });
  }

  try {
    const token = (oauthToken as string) || requestToken.requestToken;
    const { token: accessToken, tokenSecret } = await getAccessToken(
      token,
      requestToken.requestSecret,
      oauthVerifier as string,
    );

    // E*TRADE tokens expire at midnight ET — calculate next midnight
    const now = new Date();
    const midnightET = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    midnightET.setDate(midnightET.getDate() + 1);
    midnightET.setHours(0, 0, 0, 0);

    await saveUserTokens(user.id, accessToken, tokenSecret, {
      env: (process.env.ETRADE_ENV as "live" | "sandbox") ?? "live",
      expiresAt: midnightET.toISOString(),
    });

    if (req.method === "POST") {
      return res.status(200).json({ connected: true });
    }
    res.redirect("/world?etrade_success=true");
  } catch (error) {
    console.error("[etrade-callback] Error in callback:", error);
    const msg = error instanceof Error ? error.message : String(error);
    if (req.method === "POST") {
      return res.status(500).json({ error: `Authentication failed: ${msg}` });
    }
    res.status(500).send(`Authentication failed: ${msg}`);
  }
}