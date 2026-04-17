import type { IBrokerProvider } from "@/src/domain/interfaces/IBrokerProvider";
import type { ICache } from "@/src/domain/interfaces/ICache";
import type { Position } from "@/types/position.types";
import { withSyntheticHistory } from "@/src/mappers/positionMapper";
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
    const withHistory = withSyntheticHistory(positions);
    this.cache.set(CACHE_KEY, withHistory, this.cfg.newsTtlMs);
    return withHistory;
  }

  /** Returns positions with 5-min caching and automatic mock fallback. */
  async getPositionsSafe(): Promise<Position[]> {
    if (this.cfg.etradeEnv === "mock") {
      return withSyntheticHistory(MOCK_POSITIONS);
    }

    if (!this.cfg.hasOAuthTokens) {
      console.warn(
        "[etrade] OAuth tokens not set — returning mock data. Run `npm run etrade:auth` to authorize."
      );
      return withSyntheticHistory(MOCK_POSITIONS);
    }

    try {
      return await this.fetchLive();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const expired = msg.includes("401") || msg.includes("403");
      console.warn(
        expired
          ? "[etrade] OAuth tokens expired — run `npm run etrade:auth` to refresh. Returning mock data."
          : `[etrade] API error (${msg}) — returning mock data.`
      );
      return withSyntheticHistory(MOCK_POSITIONS);
    }
  }
}
