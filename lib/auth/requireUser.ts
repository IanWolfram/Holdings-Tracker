import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

/**
 * Dev-mode user returned when PULSE_SINGLE_USER_MODE=1.
 * Lets every API route function without a real Supabase session.
 */
const DEV_USER: User = Object.freeze({
  id: "dev-user-id",
  email: "dev@local",
  aud: "authenticated",
  created_at: "2025-01-01T00:00:00Z",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
} as unknown as User);

/**
 * Extract the authenticated user from the request.
 *
 * - When PULSE_SINGLE_USER_MODE=1, returns a static dev user immediately
 *   (no Supabase call, no cookie parsing).
 * - Otherwise, validates the Supabase session cookie and returns the user.
 * - On missing/invalid session, writes 401 JSON and returns null.
 */
export async function requireUser(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<User | null> {
  if (process.env.PULSE_SINGLE_USER_MODE === "1") {
    return DEV_USER;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Pages Router: cookies are on req.headers
          const header = req.headers.cookie ?? "";
          return header.split(";").map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll(cookiesToSet) {
          // Set response cookies (Set-Cookie headers)
          for (const { name, value, options } of cookiesToSet) {
            const parts = [`${name}=${value}`];
            if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
            if (options.path) parts.push(`Path=${options.path}`);
            if (options.domain) parts.push(`Domain=${options.domain}`);
            if (options.secure) parts.push("Secure");
            if (options.httpOnly) parts.push("HttpOnly");
            if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
            res.setHeader("Set-Cookie", parts.join("; "));
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return null;
  }

  return user;
}

/**
 * Type guard to check if the given user is the dev-mode singleton.
 * Useful for skipping per-user DB calls in single-user mode.
 */
export function isDevUser(user: User): boolean {
  return user.id === "dev-user-id";
}