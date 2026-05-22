/**
 * E*Trade OAuth 1.0a flow helpers.
 *
 * These functions handle the two-step OAuth handshake (request token, access token)
 * and are used by the /api/etrade/auth and /api/etrade/callback API routes.
 *
 * Data-access methods (getPositions, getCashBalance, etc.) live in
 * ETradeProvider (src/infrastructure/providers/ETradeProvider.ts).
 */

import OAuth from "oauth-1.0a";
import crypto from "crypto";
import { ETRADE_AUTH_BASE_URL } from "../constants";

function buildOAuth(): OAuth {
  return new OAuth({
    consumer: {
      key: process.env.ETRADE_CONSUMER_KEY ?? "",
      secret: process.env.ETRADE_CONSUMER_SECRET ?? "",
    },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return crypto.createHmac("sha1", key).update(baseString).digest("base64");
    },
  });
}

/** oauth-1.0a includes realm="" by default; E*Trade rejects that field entirely. */
function toHeader(oauth: OAuth, data: OAuth.Authorization): { Authorization: string } {
  const header = oauth.toHeader(data);
  // Strip 'OAuth realm="", ' or 'OAuth realm="etrade.com", ' prefix variations
  header.Authorization = header.Authorization.replace(/^OAuth realm="[^"]*",\s*/, "OAuth ");
  return header;
}

/** Step 1 of OAuth flow -- get a request token */
export async function getRequestToken(callbackUrl?: string): Promise<{
  token: string;
  tokenSecret: string;
  authUrl: string;
}> {
  const oauth = buildOAuth();
  const base = `${ETRADE_AUTH_BASE_URL}/oauth/request_token`;
  const callback = callbackUrl ?? "oob";
  // oauth_callback must be included in the URL passed to oauth.authorize so it
  // is part of the signature base string -- E*TRADE rejects unsigned parameters.
  const urlWithCallback = `${base}?oauth_callback=${encodeURIComponent(callback)}`;
  const requestData = { url: urlWithCallback, method: "GET" };

  const headers = toHeader(oauth, oauth.authorize(requestData));
  const res = await fetch(urlWithCallback, {
    headers: { ...headers, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Request token failed ${res.status}: ${body}`);
  }

  const params = new URLSearchParams(await res.text());
  const token = params.get("oauth_token") ?? "";
  const tokenSecret = params.get("oauth_token_secret") ?? "";
  const authUrl = `https://us.etrade.com/e/t/etws/authorize?key=${process.env.ETRADE_CONSUMER_KEY}&token=${token}`;

  return { token, tokenSecret, authUrl };
}

/** Step 2 of OAuth flow -- exchange verifier for access token */
export async function getAccessToken(
  requestToken: string,
  requestTokenSecret: string,
  verifier: string
): Promise<{ token: string; tokenSecret: string }> {
  const oauth = buildOAuth();
  const base = `${ETRADE_AUTH_BASE_URL}/oauth/access_token`;
  // oauth_verifier must be in the URL passed to oauth.authorize so it is part
  // of the signature base string -- E*TRADE rejects unsigned parameters.
  const urlWithVerifier = `${base}?oauth_verifier=${encodeURIComponent(verifier)}`;
  const requestData = { url: urlWithVerifier, method: "GET" };
  const tokenObj: OAuth.Token = { key: requestToken, secret: requestTokenSecret };

  const authHeader = toHeader(oauth, oauth.authorize(requestData, tokenObj));

  const res = await fetch(urlWithVerifier, {
    headers: { ...authHeader, Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Access token failed ${res.status}: ${body}`);
  }

  const params = new URLSearchParams(await res.text());
  return {
    token: params.get("oauth_token") ?? "",
    tokenSecret: params.get("oauth_token_secret") ?? "",
  };
}