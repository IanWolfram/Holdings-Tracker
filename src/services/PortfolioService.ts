import type { IBrokerProvider } from "@/src/domain/interfaces/IBrokerProvider";
import type { ICache } from "@/src/domain/interfaces/ICache";
import type { Position } from "@/types/position.types";

export interface PortfolioServiceConfig {
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

  /** Returns cash balance, or 0 if not connected / tokens expired. */
  async getCashBalanceSafe(): Promise<number> {
    if (!this.cfg.hasOAuthTokens) return 0;

    const CACHE_KEY = "cashBalance";
    const cached = this.cache.get<number>(CACHE_KEY);
    if (cached !== null && cached !== undefined) return cached;

    try {
      const balance = await this.provider.getCashBalance();
      this.cache.set(CACHE_KEY, balance, this.cfg.accountTtlMs);
      return balance;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const tokenRejected = msg.includes("401") || msg.includes("403") || msg.includes("token_rejected");
      console.warn(
        tokenRejected
          ? "[broker] Brokerage access rejected — returning 0 balance."
          : `[broker] Balance fetch error (${msg}) — returning 0.`
      );
      return 0;
    }
  }

  /** Returns live positions from the linked brokerage, or an empty array if not connected. */
  async getPositionsSafe(forceRefresh = false): Promise<{ positions: Position[]; mock: boolean }> {
    if (forceRefresh) {
      this.clearCache();
    }

    if (!this.cfg.hasOAuthTokens) {
      console.warn("[broker] No linked brokerage — returning empty positions.");
      return { positions: [], mock: false };
    }

    try {
      const positions = await this.fetchLive();
      return { positions, mock: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const expired = msg.includes("401") || msg.includes("403");
      console.warn(
        expired
          ? "[broker] Brokerage access rejected — returning empty positions."
          : `[broker] API error (${msg}) — returning empty positions.`
      );
      return { positions: [], mock: false };
    }
  }
}
