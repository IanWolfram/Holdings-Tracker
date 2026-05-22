import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { createServiceClient } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/api-handler";
import type { WatchRule } from "@/lib/agent/scheduler";

function parseRule(input: unknown): WatchRule | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  if (r.type === "verdict_flip") return { type: "verdict_flip" };
  if ((r.type === "price_above" || r.type === "price_below") && typeof r.value === "number" && r.value > 0) {
    return { type: r.type, value: r.value };
  }
  return null;
}

export default apiHandler(["GET", "POST", "DELETE"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const sb = createServiceClient();

  if (req.method === "GET") {
    const { data, error } = await sb
      .from("stock_watches")
      .select("id, symbol, rule, enabled, cooldown_minutes, last_triggered_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ watches: data ?? [] });
  }

  if (req.method === "POST") {
    const body = req.body as { symbol?: string; rule?: unknown; cooldown_minutes?: number };
    const symbol = (body.symbol ?? "").trim().toUpperCase();
    const rule = parseRule(body.rule);
    if (!symbol || !/^[A-Z.\-]{1,10}$/.test(symbol)) {
      return res.status(400).json({ error: "Invalid ticker symbol." });
    }
    if (!rule) {
      return res.status(400).json({ error: "Invalid watch rule." });
    }

    const { data, error } = await sb
      .from("stock_watches")
      .insert({
        user_id: user.id,
        symbol,
        rule,
        cooldown_minutes: typeof body.cooldown_minutes === "number" ? body.cooldown_minutes : 240,
      })
      .select("id, symbol, rule, enabled, cooldown_minutes, last_triggered_at, created_at")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ watch: data });
  }

  if (req.method === "DELETE") {
    const id = (req.query.id as string) ?? "";
    if (!id) return res.status(400).json({ error: "Missing watch id." });
    const { error } = await sb.from("stock_watches").delete().eq("id", id).eq("user_id", user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }
}, "api/agent/watches");