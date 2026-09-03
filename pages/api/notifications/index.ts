import type { NextApiResponse } from "next";
import { requireUserWithClient } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET", "PATCH"], async (req, res: NextApiResponse) => {
  // RLS-scoped: the user's JWT restricts every query below to their own rows,
  // so the explicit `.eq("user_id", …)` filters are defense-in-depth, not the
  // sole isolation mechanism.
  const { user, client: sb } = await requireUserWithClient(req, res);
  if (!user || !sb) return;

  if (req.method === "GET") {
    const { data, error } = await sb
      .from("notifications")
      .select("id, type, title, body, ticker, link, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });

    const items = data ?? [];
    const unreadCount = items.filter((n) => !n.read_at).length;
    return res.status(200).json({ notifications: items, unreadCount });
  }

  if (req.method === "PATCH") {
    const body = req.body as { id?: string; all?: boolean };
    let query = sb.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id);
    if (body.all) {
      query = query.is("read_at", null);
    } else if (body.id) {
      query = query.eq("id", body.id);
    } else {
      return res.status(400).json({ error: "Provide id or all." });
    }
    const { error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }
}, "api/notifications");