import type { IBrokerProvider } from "@/src/domain/interfaces/IBrokerProvider";
import type { ICache } from "@/src/domain/interfaces/ICache";
import type { Position } from "@/types/position.types";
import { MOCK_POSITIONS } from "@/lib/etrade";

export interface PortfolioServiceConfig {
  etradeEnv: string;
  hasOAuthTokens: boolean;
  newsTtlMs: number;
  accountTtlMs: number;
}

export class PortfolioService {
  constructor(
    private readonly provider: IBrokerProvider,
    private readonly cache: ICache,
    private readonly cfg: PortfolioServiceConfig
  ) {}

  private async fetchLive(): Promise<Position[]> {
    const CACHE_KEY = "positions";
    const cached = this.cache.get<Position[]>(CACHE_KEY);
    if (cached) return cached;

    const positions = await this.provider.getPositions();
    this.cache.set(CACHE_KEY, positions, this.cfg.newsTtlMs);
    return positions;
  }

  /** Clears the local positions cache. */
  clearCache(): void {
    this.cache.delete("positions");
  }

  /** Returns positions with 5-min caching and automatic mock fallback.
   *  The `mock` flag indicates whether positions are synthetic — callers should
   *  use it to avoid writing vault artifacts from fake data. */
  async getPositionsSafe(forceRefresh = false): Promise<{ positions: Position[]; mock: boolean }> {
    if (forceRefresh) {
      this.clearCache();
    }

    if (this.cfg.etradeEnv === "mock") {
      return { positions: MOCK_POSITIONS, mock: true };
    }

    if (!this.cfg.hasOAuthTokens) {
      console.warn(
        "[etrade] OAuth tokens not set — returning mock data. Run `npm run etrade:auth` to authorize."
      );
      return { positions: MOCK_POSITIONS, mock: true };
    }

    try {
      const positions = await this.fetchLive();
      return { positions, mock: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const expired = msg.includes("401") || msg.includes("403");
      console.warn(
        expired
          ? "[etrade] OAuth tokens expired — run `npm run etrade:auth` to refresh. Returning mock data."
          : `[etrade] API error (${msg}) — returning mock data.`
      );
      return { positions: MOCK_POSITIONS, mock: true };
    }
  }
}
