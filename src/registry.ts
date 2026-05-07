import { buildConfig } from "@/src/config";
import { MapCache } from "@/src/infrastructure/cache/MapCache";
import { DiskCache } from "@/src/infrastructure/cache/DiskCache";
import { ETradeProvider } from "@/src/infrastructure/providers/ETradeProvider";
import { FinnhubProvider } from "@/src/infrastructure/providers/FinnhubProvider";
import { PolygonProvider } from "@/src/infrastructure/providers/PolygonProvider";
import { NewsAPIProvider } from "@/src/infrastructure/providers/NewsAPIProvider";
import { SupabaseAccountInfoProvider } from "@/src/infrastructure/providers/SupabaseAccountInfoProvider";
import { DevAccountInfoProvider } from "@/src/infrastructure/providers/DevAccountInfoProvider";
import { ClassifierService } from "@/src/services/ClassifierService";
import { PortfolioService } from "@/src/services/PortfolioService";
import { NewsService } from "@/src/services/NewsService";
import type { INewsProvider } from "@/src/domain/interfaces/INewsProvider";
import type { IAccountInfoProvider } from "@/src/domain/interfaces/IAccountInfoProvider";

export type Services = {
  portfolioService: PortfolioService;
  newsService: NewsService;
  accountInfo: IAccountInfoProvider;
};

// Lazily-initialized module-level singleton so all caches and provider instances
// persist for the lifetime of the Node.js process (same behaviour as the lib/ Map caches).
let _services: Services | null = null;

function wire(): Services {
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
  const accountInfo: IAccountInfoProvider = new DevAccountInfoProvider();

  return { portfolioService, newsService, accountInfo };
}

/** Legacy singleton — used in PULSE_SINGLE_USER_MODE and by instrumentation crons. */
export function getServices(): Services {
  if (!_services) _services = wire();
  return _services;
}

// ── Per-user services ──
// In multi-tenant mode each user gets their own ETradeProvider (with their own tokens)
// but shares global news providers and classifier. Caches are scoped by key prefix.

const _userServices = new Map<string, Services>();

/**
 * Build (or return cached) services for a specific user.
 * - E*TRADE tokens are loaded from Supabase (encrypted) and injected into a per-user provider.
 * - Caches are scoped with `u:<userId>:` prefix to avoid cross-user data leaks.
 * - News providers and classifier are shared globally (they have no per-user state).
 */
export async function getServicesForUser(userId: string): Promise<Services> {
  const cached = _userServices.get(userId);
  if (cached) return cached;

  const cfg = buildConfig();

  // Try to load per-user E*TRADE tokens from Supabase.
  // In single-user mode this import is dead code, but we keep it dynamic
  // so the module loads without SUPABASE_URL in that mode.
  let oauthToken = cfg.etrade.oauthToken;
  let oauthTokenSecret = cfg.etrade.oauthTokenSecret;

  // Dynamic import avoids requiring Supabase env vars in single-user mode
  const { loadUserTokens } = await import("@/lib/etrade/tokens");
  const tokens = await loadUserTokens(userId);
  if (tokens) {
    oauthToken = tokens.oauthToken;
    oauthTokenSecret = tokens.oauthTokenSecret;
  }

  const portfolioCache = new MapCache(); // per-user cache
  const newsCache = new DiskCache(`news-${userId.slice(0, 8)}`);

  const etradeProvider = new ETradeProvider({
    ...cfg.etrade,
    oauthToken,
    oauthTokenSecret,
  });

  const portfolioService = new PortfolioService(etradeProvider, portfolioCache, {
    etradeEnv: tokens?.env ?? cfg.etrade.env,
    hasOAuthTokens: !!oauthToken && !!oauthTokenSecret,
    newsTtlMs: cfg.cache.newsTtlMs,
    accountTtlMs: cfg.cache.accountTtlMs,
  });

  // News providers are global (no per-user state) — reuse the singleton's if available
  const classifier = new ClassifierService(cfg.ai);

  const newsProviders: { finnhub?: INewsProvider; polygon?: INewsProvider; newsapi?: INewsProvider } = {
    ...(cfg.finnhub.apiKey ? { finnhub: new FinnhubProvider(cfg.finnhub.apiKey) } : {}),
    ...(cfg.polygon.apiKey ? { polygon: new PolygonProvider() } : {}),
    ...(cfg.newsapi.apiKey ? { newsapi: new NewsAPIProvider(cfg.newsapi.apiKey) } : {}),
  };

  const newsService = new NewsService(newsProviders, classifier, newsCache);

  const accountInfo: IAccountInfoProvider = new SupabaseAccountInfoProvider();

  const services: Services = { portfolioService, newsService, accountInfo };
  _userServices.set(userId, services);
  return services;
}