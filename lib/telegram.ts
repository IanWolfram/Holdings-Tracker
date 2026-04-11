import type { ClassifiedStory } from "./news";

export interface TickerDigest {
  ticker: string;
  buy: number;
  sell: number;
  hold: number;
  topBuy?: ClassifiedStory;
  topSell?: ClassifiedStory;
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Telegram env vars not set");

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
    lines.push(`*${d.ticker}*: ${d.buy} BUY · ${d.sell} SELL · ${d.hold} HOLD`);
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
