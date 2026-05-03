import { NextApiRequest, NextApiResponse } from "next";
import { getAiConfig, getModelKey, LOCAL_MODEL } from "@/lib/ai-config";
import { NEWS_CACHE_TTL_MS, ACCOUNT_CACHE_TTL_MS } from "@/lib/constants";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const aiConfig = getAiConfig();
  const supportsLocalMlx = process.platform === "darwin" && process.arch === "arm64";
  const activeModel = aiConfig.activeModelId === "local"
    ? LOCAL_MODEL
    : aiConfig.models.find((m) => m.id === aiConfig.activeModelId) ?? LOCAL_MODEL;

  return res.status(200).json({
    etrade: {
      env: process.env.ETRADE_ENV ?? "mock",
    },
    ai: {
      activeModel: activeModel.name,
      activeProvider: activeModel.provider,
      supportsLocalMlx,
      hasKey: activeModel.provider === "local" ? true : Boolean(getModelKey(activeModel.id)),
    },
    dataSources: {
      finnhub: Boolean(process.env.FINNHUB_API_KEY),
      polygon: Boolean(process.env.POLYGON_API_KEY),
      twitter: Boolean(process.env.TWITTER_BEARER_TOKEN),
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