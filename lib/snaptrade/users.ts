import { createServiceClient } from "@/lib/supabase/server";
import { sealSecret, unsealSecret } from "@/lib/crypto/bytea";
import { getSnapTradeClient, isSnapTradeConfigured } from "@/lib/snaptrade/client";

export interface SnapTradeUser {
  /** The userId registered on SnapTrade's side (we use the app user's uuid). */
  snapTradeUserId: string;
  /** Decrypted userSecret returned by SnapTrade at registration. */
  userSecret: string;
}

/**
 * Load a user's SnapTrade registration (decrypted). Returns null if the user
 * has never registered with SnapTrade.
 */
export async function loadSnapTradeUser(userId: string): Promise<SnapTradeUser | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("snaptrade_users")
    .select("snaptrade_user_id, user_secret")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  // Distinguish "no row" from "row present but unseal failed" — the latter must
  // NOT be treated as unregistered (that would wipe a live connection). Throw so
  // ensureSnapTradeUser can abort rather than delete+reregister.
  try {
    return {
      snapTradeUserId: data.snaptrade_user_id,
      userSecret: unsealSecret(data.user_secret),
    };
  } catch (err) {
    console.error("[snaptrade/users] Failed to unseal userSecret for", userId, err);
    throw new SnapTradeSecretUnsealError(userId);
  }
}

/** Thrown when a snaptrade_users row exists but its secret cannot be decrypted. */
export class SnapTradeSecretUnsealError extends Error {
  constructor(userId: string) {
    super(`SnapTrade userSecret for ${userId} could not be decrypted`);
    this.name = "SnapTradeSecretUnsealError";
  }
}

/** Whether a snaptrade_users row exists at all, regardless of decryptability. */
async function snapTradeRowExists(userId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("snaptrade_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** Detects SnapTrade's "user already exists" response (vs any other failure). */
function isUserAlreadyExistsError(err: unknown): boolean {
  const e = err as { status?: number; responseBody?: { detail?: string; code?: string | number } };
  const detail = String(e?.responseBody?.detail ?? "");
  return e?.status === 400 && /exist/i.test(detail);
}

async function saveSnapTradeUser(
  userId: string,
  snapTradeUserId: string,
  userSecret: string,
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("snaptrade_users").upsert(
    {
      user_id: userId,
      snaptrade_user_id: snapTradeUserId,
      user_secret: sealSecret(userSecret),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Failed to save SnapTrade user: ${error.message}`);
}

/**
 * Delete a user's SnapTrade registration — both on SnapTrade's side (revokes all
 * brokerage connections) and our stored row. Safe to call when not registered.
 */
export async function deleteSnapTradeUser(userId: string): Promise<void> {
  // We register with the app userId as the SnapTrade userId, so deletion needs
  // only the userId — no secret. This stays robust even if the stored secret is
  // unreadable. Always clear the local row, even if the SnapTrade call fails.
  if (isSnapTradeConfigured()) {
    try {
      await getSnapTradeClient().authentication.deleteSnapTradeUser({ userId });
    } catch (err) {
      console.warn("[snaptrade/users] deleteSnapTradeUser on SnapTrade side failed:", err);
    }
  }
  const supabase = createServiceClient();
  const { error } = await supabase.from("snaptrade_users").delete().eq("user_id", userId);
  if (error) throw new Error(`Failed to delete SnapTrade user row: ${error.message}`);
}

/**
 * Ensure the app user is registered with SnapTrade and return their credentials.
 * Idempotent: returns the stored registration if present.
 *
 * SnapTrade only returns the userSecret once (at registration). If our row is
 * missing but SnapTrade already knows this userId (e.g. a prior local delete),
 * registration 409s and the old secret is unrecoverable — so we delete the
 * SnapTrade-side user and re-register to obtain a fresh, usable secret.
 */
export async function ensureSnapTradeUser(userId: string): Promise<SnapTradeUser> {
  // loadSnapTradeUser throws SnapTradeSecretUnsealError if a row exists but its
  // secret can't be decrypted — we must NOT re-register in that case (it would
  // wipe the live brokerage connection). Let it propagate.
  const existing = await loadSnapTradeUser(userId);
  if (existing) return existing;

  const client = getSnapTradeClient();

  const register = async (): Promise<SnapTradeUser> => {
    const res = await client.authentication.registerSnapTradeUser({ userId });
    const snapTradeUserId = res.data.userId;
    const userSecret = res.data.userSecret;
    if (!snapTradeUserId || !userSecret) {
      throw new Error("SnapTrade registration returned no userId/userSecret");
    }
    return { snapTradeUserId, userSecret };
  };

  let creds: SnapTradeUser;
  try {
    creds = await register();
  } catch (err) {
    // Only recover from the specific "user already exists" case (a true orphan:
    // SnapTrade knows this userId but we hold no usable secret). On any other
    // error, fail — never delete a SnapTrade user on an unknown failure.
    if (!isUserAlreadyExistsError(err)) throw err;
    console.warn(
      "[snaptrade/users] userId orphaned on SnapTrade (exists, no local secret) — resetting",
      { userId, rowExists: await snapTradeRowExists(userId) },
    );
    try {
      await client.authentication.deleteSnapTradeUser({ userId });
    } catch (delErr) {
      console.warn("[snaptrade/users] delete during recovery failed:", delErr);
    }
    creds = await register();
  }

  await saveSnapTradeUser(userId, creds.snapTradeUserId, creds.userSecret);
  return creds;
}

/**
 * Generate a SnapTrade Connection Portal redirect URL for the user to link a
 * brokerage. Registers the user first if needed.
 */
export async function getConnectionPortalUrl(userId: string): Promise<string> {
  const { snapTradeUserId, userSecret } = await ensureSnapTradeUser(userId);
  const res = await getSnapTradeClient().authentication.loginSnapTradeUser({
    userId: snapTradeUserId,
    userSecret,
  });
  // Response is a union; the redirect form carries redirectURI.
  const data = res.data as { redirectURI?: string };
  if (!data.redirectURI) {
    throw new Error("SnapTrade did not return a redirectURI");
  }
  return data.redirectURI;
}
