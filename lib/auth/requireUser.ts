import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

export async function requireUser(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<User | null> {
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
            res.appendHeader("Set-Cookie", parts.join("; "));
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

