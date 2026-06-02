/**
 * Centralized secret hydration.
 *
 * Secrets (API keys, E*TRADE consumer credentials, etc.) live in the Supabase
 * `app_secrets` table — a single source of truth shared across environments.
 * This module reads them at server boot and copies them into `process.env` so
 * the rest of the app can keep reading `process.env.X` at call time, unaware of
 * where the value originated.
 *
 * Invoked from `src/instrumentation.ts` `register()` (Node runtime only), before
 * any request is served. CLI entry points (scripts/agent.ts, world-refresh) do
 * not pass through instrumentation and must call `hydrateSecrets()` themselves.
 *
 * Precedence: an explicitly-set environment variable (e.g. from `.env.local`)
 * always wins — we only fill keys that are currently unset or empty. That keeps
 * local overrides authoritative and guarantees we can never clobber a value that
 * is already working.
 *
 * Note: `app_secrets.value` is plaintext (distinct from the encrypted
 * `vault.secrets` table). The Supabase connection vars used to read this table
 * are deliberately NOT sourced from it — that would be circular — so they must
 * remain in the real environment (`.env.local` / deployment env).
 */
import { createClient } from "@supabase/supabase-js";

let hydrated = false;

export async function hydrateSecrets(): Promise<void> {
  if (hydrated) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn(
      "[secrets] Skipping hydration — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set."
    );
    return;
  }

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.from("app_secrets").select("key, value");
    if (error) {
      console.error("[secrets] Failed to read app_secrets:", error.message);
      return;
    }

    let filled = 0;
    for (const row of data ?? []) {
      const key = row.key as string;
      const value = row.value as string | null;
      if (!key || value === null || value === "") continue;
      // Fill-only-if-missing: never overwrite an explicit environment value.
      const existing = process.env[key];
      if (existing !== undefined && existing !== "") continue;
      process.env[key] = value;
      filled++;
    }

    hydrated = true;
    console.info(`[secrets] hydrated ${filled} key(s) from app_secrets`);
  } catch (err) {
    console.error("[secrets] Hydration error:", (err as Error).message);
  }
}
