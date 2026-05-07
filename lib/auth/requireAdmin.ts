import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Check if the given user has admin role in app_roles.
 * Uses the service-role client (bypasses RLS).
 */
export async function isAdmin(user: User): Promise<boolean> {
  if (process.env.PULSE_SINGLE_USER_MODE === "1") return true;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("app_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return data?.role === "admin";
}