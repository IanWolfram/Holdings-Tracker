import type { NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { requireUser } from "@/lib/auth/requireUser";
import { createServiceClient } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/api-handler";
import { isTelegramBotConfigured } from "@/lib/telegram";

/**
 * Telegram account linking (per-user, multi-tenant safe).
 *
 * GET    → current link status for the authed user.
 * POST   → begin linking: mint a one-time code and return a t.me deep link.
 *          The user taps it, Telegram opens the bot with `/start <code>`, and
 *          pages/api/telegram/webhook.ts matches the code back to this user and
 *          records their chat id.
 * DELETE → unlink (forget the chat id).
 */
export default apiHandler(
  ["GET", "POST", "DELETE"],
  async (req, res: NextApiResponse) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const sb = createServiceClient();
    const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? null;
    const available = isTelegramBotConfigured() && Boolean(botUsername);

    if (req.method === "GET") {
      const { data } = await sb
        .from("user_preferences")
        .select("telegram_chat_id")
        .eq("user_id", user.id)
        .maybeSingle();
      return res.status(200).json({
        available,
        linked: Boolean((data as { telegram_chat_id?: string | null } | null)?.telegram_chat_id),
      });
    }

    if (req.method === "POST") {
      if (!available) {
        return res
          .status(503)
          .json({ error: "Telegram bot is not configured on the server." });
      }
      // URL-safe, unguessable, short enough for a /start payload (≤64 chars).
      const code = randomBytes(24).toString("base64url");
      const { error } = await sb
        .from("user_preferences")
        .update({ telegram_link_code: code })
        .eq("user_id", user.id);
      if (error) return res.status(500).json({ error: "Failed to start linking." });

      return res.status(200).json({
        deepLink: `https://t.me/${botUsername}?start=${code}`,
      });
    }

    // DELETE — unlink
    const { error } = await sb
      .from("user_preferences")
      .update({ telegram_chat_id: null, telegram_link_code: null })
      .eq("user_id", user.id);
    if (error) return res.status(500).json({ error: "Failed to unlink." });
    return res.status(200).json({ ok: true });
  },
  "api/telegram/link",
);
