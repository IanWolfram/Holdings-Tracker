import { buildConfig } from "@/src/config";
import { MapCache } from "@/src/infrastructure/cache/MapCache";
import { DiskCache } from "@/src/infrastructure/cache/DiskCache";
import { ETradeProvider } from "@/src/infrastructure/providers/ETradeProvider";
import { FinnhubProvider } from "@/src/infrastructure/providers/FinnhubProvider";
import { PolygonProvider } from "@/src/infrastructure/providers/PolygonProvider";
import { NewsAPIProvider } from "@/src/infrastructure/providers/NewsAPIProvider";
import { ClassifierService } from "@/src/services/ClassifierService";
import { PortfolioService } from "@/src/services/PortfolioService";
import { NewsService } from "@/src/services/NewsService";
import type { INewsProvider } from "@/src/domain/interfaces/INewsProvider";

// Lazily-initialized module-level singleton so all caches and provider instances
// persist for the lifetime of the Node.js process (same behaviour as the lib/ Map caches).
let _services: ReturnType<typeof wire> | null = null;

function wire() {
  const cfg = buildConfig();

  const portfolioCache = new MapCache();
  // Disk-backed so cache survives Next.js HMR / worker restarts. Without this,
  // every dev-server reload sends users back through the cold-fetch path.
  const newsCache = new DiskCache("news");

  const etradeProvider = new ETradeProvider(cfg.etrade);

  const portfolioService = new PortfolioService(etradeProvider, portfolioCache, {
    etradeEnv: cfg.etrade.env,
    hasOAuthTokens: !!cfg.etrade.oauthToken && !!cfg.etrade.oauthTokenSecret,
    newsTtlMs: cfg.cache.newsTtlMs,
    accountTtlMs: cfg.cache.accountTtlMs,
  });

  const classifier = new ClassifierService(cfg.ai);

  const newsProviders: { finnhub?: INewsProvider; polygon?: INewsProvider; newsapi?: INewsProvider } = {
    ...(cfg.finnhub.apiKey ? { finnhub: new FinnhubProvider(cfg.finnhub.apiKey) } : {}),
    ...(cfg.polygon.apiKey ? { polygon: new PolygonProvider() } : {}),
    ...(cfg.newsapi.apiKey ? { newsapi: new NewsAPIProvider(cfg.newsapi.apiKey) } : {}),
  };

  const newsService = new NewsService(newsProviders, classifier, newsCache);

  return { portfolioService, newsService };
}

export function getServices() {
  if (!_services) _services = wire();
  return _services;
}
