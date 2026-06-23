import {
  NEWS_CACHE_TTL_MS,
  ACCOUNT_CACHE_TTL_MS,
} from "@/lib/constants";

export interface AppConfig {
  finnhub: {
    apiKey: string | undefined;
  };
  polygon: {
    apiKey: string | undefined;
  };
  newsapi: {
    apiKey: string | undefined;
  };
  ai: {
    engine: string;
    ollama: {
      enabled: boolean;
      baseUrl: string;
      model: string;
    };
  };
  cache: {
    newsTtlMs: number;
    accountTtlMs: number;
  };
}

export function buildConfig(): AppConfig {
  return {
    finnhub: {
      apiKey: process.env.FINNHUB_API_KEY,
    },
    polygon: {
      apiKey: process.env.POLYGON_API_KEY,
    },
    newsapi: {
      apiKey: process.env.NEWSAPI_API_KEY,
    },
    ai: {
      engine: process.env.AI_ENGINE ?? "deepseek",
      ollama: {
        enabled: process.env.OLLAMA_ENABLED === "true",
        baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
        model: process.env.OLLAMA_MODEL ?? "gemma4-aggro",
      },
    },
    cache: {
      newsTtlMs: NEWS_CACHE_TTL_MS,
      accountTtlMs: ACCOUNT_CACHE_TTL_MS,
    },
  };
}
