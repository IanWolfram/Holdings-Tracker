import type { NextApiResponse } from "next";
import { getServicesForUser } from "@/src/registry";
import { requireUser } from "@/lib/auth/requireUser";
import type { ClassifiedStory } from "@/types/news.types";
import type { TickerDigest } from "@/lib/telegram";
import { sendTelegramMessage, buildDigestMessage } from "@/lib/telegram";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["POST"], async (req, res: NextApiResponse<{ success: boolean; sentAt?: string; error?: string }>) => {
  const user = await requireUser(req, res);
  if (!user) return;

  // Trigger full portfolio digest
  try {
    const { portfolioService, newsService } = await getServicesForUser(user.id);
    const { positions } = await portfolioService.getPositionsSafe();
    const tickers = positions.map((p) => p.ticker);

    const allNews = await Promise.all(tickers.map((t) => newsService.getNewsForTicker(t)));

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
}, "api/digest");
