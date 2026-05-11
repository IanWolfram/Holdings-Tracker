import {
  NEWS_CACHE_TTL_MS,
  ACCOUNT_CACHE_TTL_MS,
  ETRADE_BASE_URL,
  ETRADE_AUTH_BASE_URL,
} from "@/lib/constants";

export interface AppConfig {
  etrade: {
    env: string;
    consumerKey: string;
    consumerSecret: string;
    oauthToken: string;
    oauthTokenSecret: string;
    baseUrl: string;
    authBaseUrl: string;
  };
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
    etrade: {
      env: process.env.ETRADE_ENV ?? "live",
      consumerKey: process.env.ETRADE_CONSUMER_KEY ?? "",
      consumerSecret: process.env.ETRADE_CONSUMER_SECRET ?? "",
      oauthToken: process.env.ETRADE_OAUTH_TOKEN ?? "",
      oauthTokenSecret: process.env.ETRADE_OAUTH_TOKEN_SECRET ?? "",
      baseUrl: ETRADE_BASE_URL,
      authBaseUrl: ETRADE_AUTH_BASE_URL,
    },
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
