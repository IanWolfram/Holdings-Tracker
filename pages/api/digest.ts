import type { NextApiRequest, NextApiResponse } from "next";
import { getPositionsSafe } from "@/lib/etrade";
import { getNewsForTicker, type ClassifiedStory } from "@/lib/news";
import type { TickerDigest } from "@/lib/telegram";
import { sendTelegramMessage, buildDigestMessage } from "@/lib/telegram";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; sentAt?: string; error?: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // Trigger full portfolio digest
  try {
    const { positions } = await getPositionsSafe();
    const tickers = positions.map((p) => p.ticker);

    const allNews = await Promise.all(tickers.map((t) => getNewsForTicker(t)));

    const digests: TickerDigest[] = tickers.map((ticker, i) => {
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

    const dashboardUrl = process.env.DASHBOARD_URL ?? "";
    const message = buildDigestMessage(digests, dashboardUrl);
    await sendTelegramMessage(message);

    const sentAt = new Date().toISOString();
    res.status(200).json({ success: true, sentAt });
  } catch (err) {
    console.error("[/api/digest]", err);
    res.status(500).json({ success: false, error: "Failed to send digest" });
  }
}
