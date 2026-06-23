import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { createServiceClient } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET", "POST", "PATCH", "DELETE"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const supabase = createServiceClient();

  // The user's dedicated, system-managed "Agent Signals" conversation is pinned
  // in the UI and rendered as a signals list — identify it by id, not title.
  async function getSignalsConvId(): Promise<string | null> {
    const { data } = await supabase
      .from("user_preferences")
      .select("signals_conversation_id")
      .eq("user_id", user!.id)
      .maybeSingle();
    return (data as { signals_conversation_id?: string } | null)?.signals_conversation_id ?? null;
  }

  if (req.method === "GET") {
    const id = req.query.id as string | undefined;

    if (id) {
      // Single conversation with messages
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .select("id, title, updated_at")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (convErr || !conv) return res.status(404).json({ error: "Not found" });

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      const signalsConvId = await getSignalsConvId();
      return res.status(200).json({
        id: conv.id,
        title: conv.title,
        kind: conv.id === signalsConvId ? "signals" : "chat",
        updatedAt: new Date(conv.updated_at).getTime(),
        messages: (msgs ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: new Date(m.created_at).getTime(),
        })),
      });
    }

    // List conversations (no messages)
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    const signalsConvId = await getSignalsConvId();
    return res.status(200).json({
      conversations: data.map((c) => ({
        id: c.id,
        title: c.title,
        kind: c.id === signalsConvId ? "signals" : "chat",
        updatedAt: new Date(c.updated_at).getTime(),
      })),
    });
  }

  if (req.method === "POST") {
    const { title } = req.body as { title?: string };
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: title ?? "New chat" })
      .select("id, title, updated_at")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      id: data.id,
      title: data.title,
      updatedAt: new Date(data.updated_at).getTime(),
      messages: [],
    });
  }

  if (req.method === "PATCH") {
    // Update title and/or append messages
    const { id, title, messages } = req.body as {
      id?: string;
      title?: string;
      messages?: { id: string; role: string; content: string }[];
    };
    if (!id) return res.status(400).json({ error: "id is required" });

    // Verify ownership
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!conv) return res.status(404).json({ error: "Not found" });

    if (title) {
      await supabase
        .from("conversations")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", id);
    } else {
      // Just bump updated_at
      await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
    }

    // Upsert messages (skip if message id already exists)
    if (messages && messages.length > 0) {
      const rows = messages.map((m) => ({
        id: m.id,
        conversation_id: id,
        role: m.role,
        content: m.content,
      }));
      const { error: msgErr } = await supabase
        .from("messages")
        .upsert(rows, { onConflict: "id" });
      if (msgErr) console.error("Failed to upsert messages:", msgErr.message);
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const id = req.query.id as string | undefined;
    if (!id) return res.status(400).json({ error: "id query param required" });

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }
}, "api/account/conversations");