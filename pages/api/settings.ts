import { NextApiRequest, NextApiResponse } from "next";
import { NEWS_CACHE_TTL_MS, ACCOUNT_CACHE_TTL_MS } from "@/lib/constants";
import { requireUser } from "@/lib/auth/requireUser";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  return res.status(200).json({
    etrade: {
      env: process.env.ETRADE_ENV ?? "live",
    },
    ai: {
      activeModel: "DeepSeek",
      activeProvider: "deepseek",
      hasKey: Boolean(process.env.DEEPSEEK_API_KEY),
    },
    dataSources: {
      finnhub: Boolean(process.env.FINNHUB_API_KEY),
      polygon: Boolean(process.env.POLYGON_API_KEY),
      newsapi: Boolean(process.env.NEWSAPI_API_KEY),
      fred: Boolean(process.env.FRED_API_KEY),
    },
    telegram: {
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    },
    ui: {
      mode: process.env.NEXT_PUBLIC_UI_MODE ?? "normal",
    },
    cache: {
      newsTtlMs: NEWS_CACHE_TTL_MS,
      positionsTtlMs: ACCOUNT_CACHE_TTL_MS,
    },
  });
}
