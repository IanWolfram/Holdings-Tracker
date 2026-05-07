import { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { saveRequestToken } from "@/lib/etrade/tokens";
import { getRequestToken } from "@/lib/etrade";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const { token, tokenSecret, authUrl } = await getRequestToken();

    if (process.env.PULSE_SINGLE_USER_MODE === "1") {
      // Single-user: store token + secret in cookies
      res.setHeader("Set-Cookie", [
        `etrade_request_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
        `etrade_request_secret=${tokenSecret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
      ]);
    } else {
      // Multi-tenant: store in Supabase
      await saveRequestToken(user.id, token, tokenSecret);
    }

    // Return the auth URL and oauth_token so the frontend can
    // redirect the user and then collect the verifier code
    res.status(200).json({ authUrl, oauthToken: token });
  } catch (error) {
    console.error("[etrade-auth] Error starting auth:", error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Failed to initiate E*Trade authentication: ${msg}` });
  }
}