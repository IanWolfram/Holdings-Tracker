import { createServerClient } from "@supabase/ssr";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Service-role client — bypasses RLS. Use only in trusted server contexts with
 * no request scope: crons, the headless worker, CLI scripts, and system-user
 * operations. Request-path handlers that act on the logged-in user's own data
 * should prefer {@link createUserClient} so Row-Level Security enforces tenant
 * isolation structurally, not by a hand-written `.eq("user_id")` that a future
 * edit could forget.
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

/** Parse the request's Cookie header into the shape @supabase/ssr expects. */
function cookiesFromRequest(req: NextApiRequest) {
  const header = req.headers.cookie ?? "";
  if (!header) return [];
  return header.split(";").map((c) => {
    const [name, ...rest] = c.trim().split("=");
    return { name, value: rest.join("=") };
  });
}

/** Serialize a refreshed session cookie back onto the response. */
function writeCookie(
  res: NextApiResponse,
  name: string,
  value: string,
  options: Record<string, unknown>,
) {
  const parts = [`${name}=${value}`];
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge as number}`);
  if (options.path) parts.push(`Path=${options.path as string}`);
  if (options.domain) parts.push(`Domain=${options.domain as string}`);
  if (options.secure) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite as string}`);
  res.appendHeader("Set-Cookie", parts.join("; "));
}

/**
 * RLS-scoped client — rides the logged-in user's JWT from the request cookies
 * (anon key + Supabase Auth), so every query is filtered by the `auth.uid() =
 * user_id` policies at the database. This makes tenant isolation a structural
 * guarantee: even a query that forgets its `.eq("user_id")` can only ever touch
 * the caller's own rows. Use this in Pages-Router API handlers for reads/writes
 * of the caller's own data. `res` is optional and only needed so a refreshed
 * session token can be written back.
 */
export function createUserClient(req: NextApiRequest, res?: NextApiResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookiesFromRequest(req);
        },
        setAll(cookiesToSet) {
          if (!res) return;
          for (const { name, value, options } of cookiesToSet) {
            writeCookie(res, name, value, options as Record<string, unknown>);
          }
        },
      },
    },
  );
}
