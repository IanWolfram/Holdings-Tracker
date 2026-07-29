import type { NextApiRequest, NextApiResponse } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/api-handler";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * Telegram webhook — receives bot updates (unauthenticated by our session; it's
 * called by Telegram's servers). Handles the `/start <code>` deep-link payload
 * minted by pages/api/telegram/link.ts: the code identifies which user is
 * linking, and we record that chat as their delivery destination.
 *
 * Security: Telegram echoes the secret token configured on setWebhook back in
 * the `X-Telegram-Bot-Api-Secret-Token` header. We reject anything that doesn't
 * match TELEGRAM_WEBHOOK_SECRET. Always 200 on accepted-but-ignored updates so
 * Telegram doesn't retry.
 *
 * One-time operator setup (not code):
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *     -d url="<DASHBOARD_URL>/api/telegram/webhook" \
 *     -d secret_token="<TELEGRAM_WEBHOOK_SECRET>"
 */
interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number | string };
  };
}

export default apiHandler(
  ["POST"],
  async (req: NextApiRequest, res: NextApiResponse) => {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expected) {
      const got = req.headers["x-telegram-bot-api-secret-token"];
      if (got !== expected) return res.status(401).json({ error: "unauthorized" });
    }

    const update = (req.body ?? {}) as TelegramUpdate;
    const text = update.message?.text?.trim() ?? "";
    const chatId = update.message?.chat?.id;

    // Only the /start linking payload is actionable; ack everything else.
    const match = text.match(/^\/start\s+(\S+)/);
    if (!match || chatId == null) return res.status(200).json({ ok: true });

    const code = match[1];
    const sb = createServiceClient();
    const { data: pref } = await sb
      .from("user_preferences")
      .select("user_id")
      .eq("telegram_link_code", code)
      .maybeSingle();

    const userId = (pref as { user_id?: string } | null)?.user_id;
    if (!userId) {
      await sendTelegramMessage(
        String(chatId),
        "That link has expired or is invalid. Start again from the app's Notifications settings.",
      ).catch(() => {});
      return res.status(200).json({ ok: true });
    }

    // Bind this chat to the user and burn the one-time code.
    await sb
      .from("user_preferences")
      .update({ telegram_chat_id: String(chatId), telegram_link_code: null })
      .eq("user_id", userId);

    await sendTelegramMessage(
      String(chatId),
      "✅ Linked. You'll now receive your Pulse portfolio digest here.",
    ).catch(() => {});

    return res.status(200).json({ ok: true });
  },
  "api/telegram/webhook",
  { ipRateLimit: false },
);
