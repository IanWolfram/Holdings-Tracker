import { createServiceClient } from "@/lib/supabase/server";
import { encryptForStorage, decryptFromStorage } from "@/lib/crypto/tokenCipher";

export interface ETradeUserTokens {
  oauthToken: string;
  oauthTokenSecret: string;
  accountIdKey?: string;
  env: "live" | "sandbox";
  expiresAt: string | null;
  authorizedAt: string;
}

/**
 * Load a user's decrypted E*TRADE tokens from Supabase.
 * Returns null if no tokens exist for this user.
 */
export async function loadUserTokens(userId: string): Promise<ETradeUserTokens | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("etrade_tokens")
    .select("oauth_token_ct, oauth_secret_ct, iv, auth_tag, key_version, account_id_key, env, expires_at, authorized_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  try {
    const oauthToken = decryptFromStorage(
      data.oauth_token_ct as Uint8Array,
      data.iv as Uint8Array,
      data.auth_tag as Uint8Array,
      data.key_version as number,
    );
    // For the secret, we store it with the same IV/tag structure.
    // The oauth_secret_ct uses the same key_version. We need a separate
    // decryption — but since we encrypted both with the same key, we just
    // decrypt each blob independently.
    // Note: the current schema stores one iv and auth_tag pair for both
    // ciphertexts. We'll encrypt the secret as a second operation in saveUserTokens.
    // For now, load assumes the secret is encrypted separately — but the schema
    // only has one iv/tag pair. We'll handle this by concatenating in storage.
    // Actually, let's use a combined approach: store both token+secret in one
    // encrypted blob as JSON. This is simpler and uses the single iv/tag columns.

    // Re-decrypt: the ciphertext is actually a JSON string with both values
    const combined = JSON.parse(oauthToken) as {
      token: string;
      secret: string;
    };

    return {
      oauthToken: combined.token,
      oauthTokenSecret: combined.secret,
      accountIdKey: data.account_id_key ?? undefined,
      env: data.env as "live" | "sandbox",
      expiresAt: data.expires_at,
      authorizedAt: data.authorized_at,
    };
  } catch {
    console.error("[etrade/tokens] Decryption failed for user", userId);
    return null;
  }
}

/**
 * Save (upsert) a user's E*TRADE tokens, encrypted at rest.
 * Both oauth_token and oauth_token_secret are packed into a single
 * encrypted JSON blob so we use the single iv/auth_tag columns naturally.
 */
export async function saveUserTokens(
  userId: string,
  oauthToken: string,
  oauthTokenSecret: string,
  opts: {
    accountIdKey?: string;
    env?: "live" | "sandbox";
    expiresAt?: string;
  } = {},
): Promise<void> {
  const supabase = createServiceClient();

  const plaintext = JSON.stringify({ token: oauthToken, secret: oauthTokenSecret });
  const encrypted = encryptForStorage(plaintext);

  const { error } = await supabase.from("etrade_tokens").upsert(
    {
      user_id: userId,
      oauth_token_ct: Buffer.from(encrypted.ciphertext),
      oauth_secret_ct: Buffer.alloc(0), // not used in combined mode, but column is NOT NULL
      iv: Buffer.from(encrypted.iv),
      auth_tag: Buffer.from(encrypted.authTag),
      key_version: encrypted.keyVersion,
      account_id_key: opts.accountIdKey ?? null,
      env: opts.env ?? "live",
      expires_at: opts.expiresAt ?? null,
      authorized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to save E*TRADE tokens: ${error.message}`);
  }
}

/**
 * Delete a user's E*TRADE tokens (e.g. on disconnect).
 */
export async function deleteUserTokens(userId: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("etrade_tokens")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete E*TRADE tokens: ${error.message}`);
  }
}

/**
 * Store a short-lived OAuth request token + secret so the callback
 * can look it up after the user authorizes on E*TRADE's site.
 */
export async function saveRequestToken(
  userId: string,
  requestToken: string,
  requestSecret: string,
): Promise<void> {
  const supabase = createServiceClient();

  // 10 minute expiry — E*TRADE request tokens are short-lived
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase.from("etrade_request_tokens").upsert(
    {
      user_id: userId,
      request_token: requestToken,
      request_secret: requestSecret,
      expires_at: expiresAt,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to save request token: ${error.message}`);
  }
}

/**
 * Load and consume a pending request token. Returns null if not found or expired.
 * Deletes the row after reading (one-time use).
 */
export async function consumeRequestToken(
  userId: string,
): Promise<{ requestToken: string; requestSecret: string } | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("etrade_request_tokens")
    .select("request_token, request_secret, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  // Delete regardless of expiry
  await supabase.from("etrade_request_tokens").delete().eq("user_id", userId);

  if (new Date(data.expires_at) < new Date()) return null;

  return {
    requestToken: data.request_token,
    requestSecret: data.request_secret,
  };
}