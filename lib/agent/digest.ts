/**
 * Per-user portfolio digest: summarize each holding's current news verdicts and
 * top signals, then deliver to the user's linked Telegram chat.
 *
 * Multi-tenant: everything is keyed to a single userId and the digest is only
 * ever sent to that user's own `telegram_chat_id` (see lib/telegram.ts). A user
 * with no linked chat is a clean no-op.
 */
import { getServicesForUser } from "@/src/registry";
import { createServiceClient } from "@/lib/supabase/server";
import type { ClassifiedStory } from "@/types/news.types";
import { buildDigestMessage, sendTelegramMessage, type TickerDigest } from "@/lib/telegram";

/** Build the per-ticker digest rows for a user from their current news feed. */
export async function buildUserDigests(userId: string): Promise<TickerDigest[]> {
  const { portfolioService, newsService } = await getServicesForUser(userId);
  const { positions } = await portfolioService.getPositionsSafe();
  const tickers = positions.map((p) => p.ticker);
  if (tickers.length === 0) return [];

  const allNews = await Promise.all(tickers.map((t) => newsService.getNewsForTicker(t)));

  return tickers.map((ticker, i) => {
    const stories = allNews[i];
    const buy = stories.filter((s) => s.verdict === "BUY").length;
    const sell = stories.filter((s) => s.verdict === "SELL").length;
    const hold = stories.filter((s) => s.verdict === "HOLD").length;

    const topBuy = stories
      .filter((s): s is ClassifiedStory => s.verdict === "BUY")
      .sort((a, b) => b.confidence - a.confidence)[0];
    const topSell = stories
      .filter((s): s is ClassifiedStory => s.verdict === "SELL")
      .sort((a, b) => b.confidence - a.confidence)[0];

    return { ticker, buy, sell, hold, topBuy, topSell };
  });
}

/** Load a user's linked Telegram chat id, or null if they haven't linked one. */
export async function getTelegramChatId(userId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("user_preferences")
    .select("telegram_chat_id")
    .eq("user_id", userId)
    .maybeSingle();
  const id = (data as { telegram_chat_id?: string | null } | null)?.telegram_chat_id;
  return id ?? null;
}

export type DigestResult =
  | { status: "sent"; tickers: number }
  | { status: "skipped"; reason: string };

/**
 * Build and deliver a user's digest to their linked Telegram chat. Returns a
 * skip result (never throws for the common "not linked / empty portfolio"
 * cases) so schedulers can record an honest, non-error outcome.
 */
export async function sendUserDigest(userId: string): Promise<DigestResult> {
  const chatId = await getTelegramChatId(userId);
  if (!chatId) return { status: "skipped", reason: "no linked Telegram chat" };

  const digests = await buildUserDigests(userId);
  if (digests.length === 0) return { status: "skipped", reason: "empty portfolio" };

  const dashboardUrl = process.env.DASHBOARD_URL ?? "";
  const message = buildDigestMessage(digests, dashboardUrl);
  await sendTelegramMessage(chatId, message);
  return { status: "sent", tickers: digests.length };
}
