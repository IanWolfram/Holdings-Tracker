import { createServiceClient } from "@/lib/supabase/server";
import { encryptForStorage, encrypt, decrypt } from "@/lib/crypto/tokenCipher";

/**
 * supabase-js returns bytea columns as PostgreSQL hex strings ("\x...") in
 * JSON responses, NOT as Buffers/Uint8Arrays. And on write, sending raw Buffer
 * values gets JSON.stringify'd to `{type:"Buffer",data:[...]}` which is not a
 * valid bytea literal. We normalize to hex strings in both directions.
 */
function toByteaHex(buf: Buffer): string {
  return "\\x" + buf.toString("hex");
}

function fromBytea(value: unknown): Buffer {
  if (value == null) throw new Error("bytea value is null");
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    if (value.startsWith("\\x")) return Buffer.from(value.slice(2), "hex");
    if (value.startsWith("0x")) return Buffer.from(value.slice(2), "hex");
    // Fallback: try base64
    return Buffer.from(value, "base64");
  }
  // Sometimes serialized as { type: 'Buffer', data: [...] }
  if (typeof value === "object" && value !== null && "data" in (value as Record<string, unknown>)) {
    const data = (value as { data: unknown }).data;
    if (Array.isArray(data)) return Buffer.from(data as number[]);
  }
  throw new Error(`Unsupported bytea value shape: ${typeof value}`);
}

/**
 * Pack/unpack an AES-256-GCM blob as a single base64 JSON string so it can
 * live in an existing text column without a schema migration.
 */
function sealSecret(plaintext: string): string {
  const blob = encrypt(plaintext);
  const payload = {
    v: blob.keyVersion,
    iv: blob.iv.toString("base64"),
    t: blob.authTag.toString("base64"),
    c: blob.ciphertext.toString("base64"),
  };
  return "enc:v1:" + Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function unsealSecret(stored: string): string {
  if (!stored.startsWith("enc:v1:")) {
    // Legacy plaintext row — return as-is (will be rotated on next save).
    return stored;
  }
  const json = Buffer.from(stored.slice("enc:v1:".length), "base64").toString("utf8");
  const payload = JSON.parse(json) as { v: number; iv: string; t: string; c: string };
  return decrypt({
    keyVersion: payload.v,
    iv: Buffer.from(payload.iv, "base64"),
    authTag: Buffer.from(payload.t, "base64"),
    ciphertext: Buffer.from(payload.c, "base64"),
  });
}

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

  if (error || !data) {
    console.warn("[etrade/tokens] No token row for user", userId, error?.message);
    return null;
  }

  try {
    const ciphertext = fromBytea(data.oauth_token_ct);
    const iv = fromBytea(data.iv);
    const authTag = fromBytea(data.auth_tag);

    console.debug("[etrade/tokens] loaded tokens for user", userId);

    const plaintext = decrypt({
      ciphertext,
      iv,
      authTag,
      keyVersion: data.key_version as number,
    });

    const combined = JSON.parse(plaintext) as { token: string; secret: string };

    return {
      oauthToken: combined.token,
      oauthTokenSecret: combined.secret,
      accountIdKey: data.account_id_key ?? undefined,
      env: data.env as "live" | "sandbox",
      expiresAt: data.expires_at,
      authorizedAt: data.authorized_at,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[etrade/tokens] Decryption failed for user", userId, msg);
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
      // bytea columns: send PostgreSQL hex format ("\x...") as a string.
      // Raw Buffer values get JSON.stringify'd to {type:"Buffer",data:[...]} which
      // PostgREST cannot coerce into bytea and silently stores garbage.
      oauth_token_ct: toByteaHex(Buffer.from(encrypted.ciphertext)),
      oauth_secret_ct: toByteaHex(Buffer.alloc(0)), // unused in combined-blob mode, but NOT NULL
      iv: toByteaHex(Buffer.from(encrypted.iv)),
      auth_tag: toByteaHex(Buffer.from(encrypted.authTag)),
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
      request_secret: sealSecret(requestSecret),
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

  try {
    return {
      requestToken: data.request_token,
      requestSecret: unsealSecret(data.request_secret),
    };
  } catch {
    console.error("[etrade/tokens] Failed to unseal request secret for user", userId);
    return null;
  }
}