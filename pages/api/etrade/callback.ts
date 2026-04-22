
import { NextApiRequest, NextApiResponse } from "next";
import { getAccessToken, updateEtradeTokens } from "@/lib/etrade";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { oauth_token, oauth_verifier } = req.query;
  const requestSecret = req.cookies.etrade_request_secret;

  if (!oauth_token || !oauth_verifier || !requestSecret) {
    return res.status(400).send("Missing OAuth parameters or session expired. Please try again.");
  }

  try {
    console.log("[etrade-callback] Exchanging verifier for access token...");
    
    const { token, tokenSecret } = await getAccessToken(
      oauth_token as string,
      requestSecret,
      oauth_verifier as string
    );

    console.log("[etrade-callback] Success! Updating .env.local...");
    await updateEtradeTokens(token, secret); // Wait, I need to check the variable name in getAccessToken return

    // Re-viewing getAccessToken in lib/etrade.ts... it returns { token, tokenSecret }
    await updateEtradeTokens(token, tokenSecret);

    // Clear the temporary cookie
    res.setHeader("Set-Cookie", "etrade_request_secret=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");

    // Redirect back to the dashboard with a success message
    res.redirect("/?etrade_success=true");
  } catch (error) {
    console.error("[etrade-callback] Error in callback:", error);
    res.status(500).send(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
