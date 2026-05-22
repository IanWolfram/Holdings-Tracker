import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { createServiceClient } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET", "POST", "DELETE"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const supabase = createServiceClient();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("proposed_positions")
      .select("ticker, target_shares, target_price, added_at")
      .eq("user_id", user.id)
      .order("added_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ positions: data });
  }

  if (req.method === "POST") {
    const { ticker, targetShares, targetPrice } = req.body as {
      ticker?: string;
      targetShares?: number;
      targetPrice?: number;
    };
    if (!ticker || typeof ticker !== "string") {
      return res.status(400).json({ error: "ticker is required" });
    }

    const insert = {
      user_id: user.id,
      ticker: ticker.toUpperCase().trim(),
      target_shares: targetShares ?? null,
      target_price: targetPrice ?? null,
    };

    const { data, error } = await supabase
      .from("proposed_positions")
      .upsert(insert, { onConflict: "user_id,ticker" })
      .select("ticker, target_shares, target_price, added_at")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ position: data });
  }

  if (req.method === "DELETE") {
    const ticker = (req.query.ticker as string)?.toUpperCase().trim();
    if (!ticker) return res.status(400).json({ error: "ticker query param required" });

    const { error } = await supabase
      .from("proposed_positions")
      .delete()
      .eq("user_id", user.id)
      .eq("ticker", ticker);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }
}, "api/account/proposed-positions");