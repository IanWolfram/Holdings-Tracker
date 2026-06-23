import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { createServiceClient } from "@/lib/supabase/server";
import { invalidateUserServices } from "@/src/registry";
import { apiHandler } from "@/lib/api-handler";
import { log } from "@/lib/logger";

/**
 * Per-user tables to purge on account deletion. Derived from every public table
 * carrying a `user_id` column (see docs/data-handling.md). `messages` is omitted
 * because it cascades from `conversations` (ON DELETE CASCADE).
 */
const USER_SCOPED_TABLES = [
  "agent_jobs",
  "app_roles",
  "conversations", // cascades to messages
  "notifications",
  "proposed_positions",
  "snaptrade_users",
  "stock_watches",
  "user_activity",
  "user_preferences",
  "vault_notes",
] as const;

/**
 * Self-service account + data deletion (Layer 0 / GDPR-style erasure).
 *
 * Requires the caller to confirm by passing their own email in the body, to
 * guard against accidental or CSRF-driven calls. Deletes all user-scoped rows
 * via the service-role client (bypassing RLS), clears in-process caches, then
 * deletes the Supabase Auth user. Auth deletion happens LAST so a transient
 * failure mid-purge leaves the account intact and retryable.
 */
export default apiHandler(["POST"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const body = (req.body ?? {}) as { confirmEmail?: string };
  const confirmEmail = typeof body.confirmEmail === "string" ? body.confirmEmail.trim() : "";

  if (!confirmEmail || confirmEmail.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return res.status(400).json({
      error: "Confirmation failed: confirmEmail must match your account email",
    });
  }

  const supabase = createServiceClient();

  // 0. Best-effort revoke on SnapTrade's side (deletes the SnapTrade user +
  // brokerage connections). Non-fatal: if SnapTrade is unreachable we still
  // proceed — the local row purge below removes our copy regardless.
  try {
    const { deleteSnapTradeUser } = await import("@/lib/snaptrade/users");
    await deleteSnapTradeUser(user.id);
  } catch (err) {
    log.warn("api/account/delete", `SnapTrade-side deletion failed (continuing): ${err instanceof Error ? err.message : String(err)}`);
  }

  // 1. Purge all user-scoped table rows.
  const results = await Promise.all(
    USER_SCOPED_TABLES.map(async (table) => {
      const { error } = await supabase.from(table).delete().eq("user_id", user.id);
      return { table, error: error?.message ?? null };
    }),
  );

  const failures = results.filter((r) => r.error);
  if (failures.length > 0) {
    for (const f of failures) log.error("api/account/delete", `${f.table}: ${f.error}`);
    return res.status(500).json({
      error: "Some account data could not be deleted. Part of your data may already have been removed; your login is still active — please retry to complete deletion.",
      failedTables: failures.map((f) => f.table),
    });
  }

  // 2. Drop any in-process per-user caches/providers.
  invalidateUserServices(user.id);

  // 3. Delete the auth user itself (last — leaves account recoverable if this is reached only after a clean purge).
  const { error: authErr } = await supabase.auth.admin.deleteUser(user.id);
  if (authErr) {
    log.error("api/account/delete", `auth.admin.deleteUser: ${authErr.message}`);
    return res.status(500).json({
      error: "Account data was removed but the login could not be deleted. Please contact support.",
    });
  }

  log.info("api/account/delete", `deleted account ${user.id}`);
  return res.status(200).json({ ok: true });
}, "api/account/delete");
