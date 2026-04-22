
import { NextApiRequest, NextApiResponse } from "next";
import { getRequestToken } from "@/lib/etrade";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host;
    const callbackUrl = `${protocol}://${host}/api/etrade/callback`;

    console.log(`[etrade-auth] Starting flow with callback: ${callbackUrl}`);
    
    const { token, tokenSecret, authUrl } = await getRequestToken(callbackUrl);

    // We need to store the tokenSecret temporarily because we'll need it for the access token exchange.
    // In a production app, we'd use a session or a secure cookie.
    // Since this is a local tool, we'll set a cookie.
    res.setHeader("Set-Cookie", `etrade_request_secret=${tokenSecret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
    
    res.redirect(authUrl);
  } catch (error) {
    console.error("[etrade-auth] Error starting auth:", error);
    res.status(500).json({ error: "Failed to initiate E*Trade authentication" });
  }
}
