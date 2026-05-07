import { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // In Personal Mode there's no session to sign out of.
  if (process.env.PULSE_SINGLE_USER_MODE === "1") {
    return res.status(200).json({ ok: true });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const header = req.headers.cookie ?? "";
          return header.split(";").map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: rest.join("=") };
          });
        },
        setAll(cookiesToSet) {
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

  await supabase.auth.signOut();

  return res.status(200).json({ ok: true });
}