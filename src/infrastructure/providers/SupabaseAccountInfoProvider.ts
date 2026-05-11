import { createServiceClient } from "@/lib/supabase/server";
import type {
  AccountInfo,
  UserPreferences,
  IAccountInfoProvider,
} from "@/src/domain/interfaces/IAccountInfoProvider";

export class SupabaseAccountInfoProvider implements IAccountInfoProvider {
  async getAccountInfo(userId: string): Promise<AccountInfo> {
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
    const supabase = createServiceClient();

    const { data } = await supabase
      .from("user_preferences")
      .select("cron_opt_in, ai_model_id, vault_enabled")
      .eq("user_id", userId)
      .single();

    return {
      cronOptIn: data?.cron_opt_in ?? false,
      aiModel: data?.ai_model_id ?? null,
      vaultEnabled: data?.vault_enabled ?? false,
    };
  }

  async updatePreferences(
    userId: string,
    patch: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const supabase = createServiceClient();

    const update: Record<string, unknown> = {};
    if (patch.cronOptIn !== undefined) update.cron_opt_in = patch.cronOptIn;
    if (patch.aiModel !== undefined) update.ai_model_id = patch.aiModel;
    if (patch.vaultEnabled !== undefined) update.vault_enabled = patch.vaultEnabled;

    const { error } = await supabase
      .from("user_preferences")
      .update(update)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to update preferences: ${error.message}`);

    return this.getPreferences(userId);
  }

  async getEtradeTokenExpiry(
    userId: string,
  ): Promise<{ expiresAt: string | null }> {
    const supabase = createServiceClient();

    const { data } = await supabase
      .from("etrade_tokens")
      .select("expires_at")
      .eq("user_id", userId)
      .single();

    return { expiresAt: data?.expires_at ?? null };
  }
}