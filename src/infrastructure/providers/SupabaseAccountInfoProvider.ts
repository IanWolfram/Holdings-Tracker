import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_TIMESCALE } from "@/lib/timescales";
import { DEFAULT_ANALYZED_AGE_DAYS } from "@/lib/analyzedAge";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountInfo,
  UserPreferences,
  IAccountInfoProvider,
} from "@/src/domain/interfaces/IAccountInfoProvider";

export class SupabaseAccountInfoProvider implements IAccountInfoProvider {
  /**
   * @param prefsClient  optional RLS-scoped client (the caller's JWT) used ONLY
   *   by the `user_preferences` methods, so a request path enforces isolation on
   *   that table at the database. `getAccountInfo` ignores it: the Supabase Auth
   *   admin API it calls requires the service-role key. Omit in worker/cron/CLI
   *   contexts to use service-role throughout (the registry does this).
   */
  constructor(private prefsClient?: SupabaseClient) {}

  /** Client for the user_preferences table — RLS-scoped when one was injected. */
  private prefsDb(): SupabaseClient {
    return this.prefsClient ?? createServiceClient();
  }

  async getAccountInfo(userId: string): Promise<AccountInfo> {
    // Always service-role: auth.admin.getUserById needs it; an anon/RLS client
    // cannot reach the Auth admin API.
    const supabase = createServiceClient();

    // auth.users is not accessible via the client API, so we read
    // from the public user_activity row (created_at is synced) and
    // fall back to minimal info when the admin RPC isn't available.
    // Use admin API to fetch auth metadata (display_name column doesn't exist)
    const { data: userData } = await supabase.auth.admin.getUserById(userId);

    return {
      id: userId,
      email: userData?.user?.email ?? null,
      displayName: userData?.user?.user_metadata?.full_name ?? null,
      createdAt: userData?.user?.created_at ?? new Date().toISOString(),
      lastSignInAt: userData?.user?.last_sign_in_at ?? null,
    };
  }

  async getPreferences(userId: string): Promise<UserPreferences> {
    const supabase = this.prefsDb();

    const { data } = await supabase
      .from("user_preferences")
      .select("cron_opt_in, vault_enabled, default_timescale, analyzed_max_age_days")
      .eq("user_id", userId)
      .single();

    return {
      cronOptIn: data?.cron_opt_in ?? false,
      vaultEnabled: data?.vault_enabled ?? false,
      defaultTimescale: data?.default_timescale ?? DEFAULT_TIMESCALE,
      analyzedMaxAgeDays: data?.analyzed_max_age_days ?? DEFAULT_ANALYZED_AGE_DAYS,
    };
  }

  async updatePreferences(
    userId: string,
    patch: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const supabase = this.prefsDb();

    const update: Record<string, unknown> = {};
    if (patch.cronOptIn !== undefined) update.cron_opt_in = patch.cronOptIn;
    if (patch.vaultEnabled !== undefined) update.vault_enabled = patch.vaultEnabled;
    if (patch.defaultTimescale !== undefined) update.default_timescale = patch.defaultTimescale;
    if (patch.analyzedMaxAgeDays !== undefined) update.analyzed_max_age_days = patch.analyzedMaxAgeDays;

    const { error } = await supabase
      .from("user_preferences")
      .update(update)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to update preferences: ${error.message}`);

    return this.getPreferences(userId);
  }
}