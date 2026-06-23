import { Snaptrade } from "snaptrade-typescript-sdk";

/**
 * Process-wide SnapTrade SDK client. clientId + consumerKey are global app
 * credentials (from app_secrets → process.env via hydrateSecrets). Per-user
 * auth is carried separately as (snapTradeUserId, userSecret) on each call.
 */
let _client: Snaptrade | null = null;

export function isSnapTradeConfigured(): boolean {
  return !!process.env.SNAPTRADE_CLIENT_ID && !!process.env.SNAPTRADE_CONSUMER_KEY;
}

export function getSnapTradeClient(): Snaptrade {
  if (_client) return _client;
  const clientId = process.env.SNAPTRADE_CLIENT_ID;
  const consumerKey = process.env.SNAPTRADE_CONSUMER_KEY;
  if (!clientId || !consumerKey) {
    throw new Error(
      "SnapTrade not configured: SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY missing",
    );
  }
  _client = new Snaptrade({ clientId, consumerKey });
  return _client;
}
