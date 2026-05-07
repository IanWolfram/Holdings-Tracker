/**
 * One-shot migration: reads E*TRADE tokens from .env.local and stores them
 * encrypted in Supabase for a given user.
 *
 * Usage:
 *   npx tsx scripts/migrate-etrade-tokens.ts <user-id>
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ETRADE_TOKEN_ENC_KEY (32-byte hex for AES-256-GCM)
 *   ETRADE_OAUTH_TOKEN (from .env.local)
 *   ETRADE_OAUTH_TOKEN_SECRET (from .env.local)
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { encryptForStorage } from "../lib/crypto/tokenCipher";

config({ path: resolve(process.cwd(), ".env.local") });

const USER_ID = process.argv[2];
if (!USER_ID) {
  console.error("Usage: npx tsx scripts/migrate-etrade-tokens.ts <user-id>");
  process.exit(1);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encKey = process.env.ETRADE_TOKEN_ENC_KEY;
  const oauthToken = process.env.ETRADE_OAUTH_TOKEN;
  const oauthTokenSecret = process.env.ETRADE_OAUTH_TOKEN_SECRET;

  if (!supabaseUrl || !serviceKey || !encKey) {
    console.error("Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ETRADE_TOKEN_ENC_KEY");
    process.exit(1);
  }

  if (!oauthToken || !oauthTokenSecret) {
    console.error("No E*TRADE tokens found in .env.local — nothing to migrate.");
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Encrypt both values together as JSON (same approach as saveUserTokens)
  const plaintext = JSON.stringify({ token: oauthToken, secret: oauthTokenSecret });
  const encrypted = encryptForStorage(plaintext);

  // Calculate midnight ET for expiry
  const now = new Date();
  const midnightET = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  midnightET.setDate(midnightET.getDate() + 1);
  midnightET.setHours(0, 0, 0, 0);

  const { error } = await supabase.from("etrade_tokens").upsert({
    user_id: USER_ID,
    oauth_token_ct: Buffer.from(encrypted.ciphertext),
    oauth_secret_ct: Buffer.alloc(0),
    iv: Buffer.from(encrypted.iv),
    auth_tag: Buffer.from(encrypted.authTag),
    key_version: encrypted.keyVersion,
    env: process.env.ETRADE_ENV || "live",
    expires_at: midnightET.toISOString(),
    authorized_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) {
    console.error("Failed to insert tokens:", error.message);
    process.exit(1);
  }

  console.log(`✓ E*TRADE tokens migrated for user ${USER_ID}`);
  console.log(`  Expires at: ${midnightET.toISOString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});