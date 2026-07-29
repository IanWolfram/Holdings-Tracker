import { createServerClient } from "@supabase/ssr";

/**
 * Service-role client — bypasses RLS. Only use in trusted server contexts
 * (API routes that have already authenticated the user via requireUser).
 */
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    },
  );
}