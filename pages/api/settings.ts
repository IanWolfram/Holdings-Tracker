import type { NextApiResponse } from "next";
import { NEWS_CACHE_TTL_MS, ACCOUNT_CACHE_TTL_MS } from "@/lib/constants";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";
import { isTelegramBotConfigured } from "@/lib/telegram";
import { getTelegramChatId } from "@/lib/agent/digest";

export default apiHandler(["GET"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  // Per-user: the bot is a shared secret, but "configured" means THIS user has
  // linked their own chat. `available` gates whether the setup flow can run.
  const botAvailable = isTelegramBotConfigured();
  const chatId = botAvailable ? await getTelegramChatId(user.id) : null;

  return res.status(200).json({
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
      configured: Boolean(chatId),
      available: botAvailable,
    },
    ui: {
      mode: process.env.NEXT_PUBLIC_UI_MODE ?? "normal",
    },
    cache: {
      newsTtlMs: NEWS_CACHE_TTL_MS,
      positionsTtlMs: ACCOUNT_CACHE_TTL_MS,
    },
  });
}, "api/settings");
