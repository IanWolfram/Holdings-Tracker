import { type ClassifiedStory, VERDICT_LABEL } from "@/types/news.types";

export interface TickerDigest {
  ticker: string;
  buy: number;
  sell: number;
  hold: number;
  topBuy?: ClassifiedStory;
  topSell?: ClassifiedStory;
}

/** Is the bot itself configured (single global bot token serves every tenant)? */
export function isTelegramBotConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

/**
 * Send a message to a specific chat. `chatId` is PER-USER — this app is
 * multi-tenant, so the destination must be the recipient's own linked chat,
 * never a process-wide TELEGRAM_CHAT_ID (that would fan every tenant's digest
 * into one inbox). The bot token is the one shared, portfolio-agnostic secret.
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  if (!chatId) throw new Error("Telegram chatId is required");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram send failed ${res.status}: ${body}`);
  }
}

export function buildDigestMessage(
  digests: TickerDigest[],
  dashboardUrl: string
): string {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const lines: string[] = [`📊 *Daily Stock Digest — ${date}*\n`];

  for (const d of digests) {
    lines.push(`*${d.ticker}*: ${d.buy} ${VERDICT_LABEL.BUY} · ${d.hold} ${VERDICT_LABEL.HOLD} · ${d.sell} ${VERDICT_LABEL.SELL}`);
  }

  const topSignals = digests.flatMap((d) => [d.topBuy, d.topSell]).filter(Boolean) as ClassifiedStory[];
  topSignals.sort((a, b) => b.confidence - a.confidence);
  const top = topSignals.slice(0, 4);

  if (top.length > 0) {
    lines.push("\n*Top signals:*");
    for (const s of top) {
      const emoji = s.verdict === "BUY" ? "🟢" : s.verdict === "SELL" ? "🔴" : "⚪";
      const pct = Math.round(s.confidence * 100);
      lines.push(`${emoji} ${s.ticker} — "${s.headline}" (${pct}%)`);
    }
  }

  if (dashboardUrl) {
    lines.push(`\n[View full dashboard](${dashboardUrl})`);
  }

  return lines.join("\n");
}
