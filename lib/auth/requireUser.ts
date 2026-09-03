import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase/server";

/**
 * Authenticate the request's user. Returns the `User` or sends a 401 and
 * returns null. The RLS-scoped client used to validate the session is the same
 * one a handler should use for the user's own data — get it from
 * {@link requireUserWithClient} to avoid rebuilding it.
 */
export async function requireUser(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<User | null> {
  return (await requireUserWithClient(req, res)).user;
}

/**
 * Like {@link requireUser} but also returns the request-scoped Supabase client
 * (RLS-enforced, riding the user's JWT). `client` is null when unauthenticated.
 * Prefer this in handlers that go on to read/write the caller's own rows: the
 * database enforces tenant isolation, so a forgotten filter can't leak.
 */
export async function requireUserWithClient(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<{ user: User | null; client: SupabaseClient | null }> {
  const supabase = createUserClient(req, res);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    res.status(401).json({ error: "unauthenticated" });
    return { user: null, client: null };
  }

  return { user, client: supabase };
}
