import type { IBrokerProvider } from "@/src/domain/interfaces/IBrokerProvider";
import type { Position } from "@/types/position.types";
import { getSnapTradeClient } from "@/lib/snaptrade/client";
import { mapSnapTradePosition, type SnapTradePositionLike } from "@/src/mappers/snaptradePositionMapper";

export interface SnapTradeProviderConfig {
  /** SnapTrade-side userId (the app user's uuid). */
  snapTradeUserId: string;
  /** Decrypted SnapTrade userSecret. */
  userSecret: string;
}

/**
 * Broker adapter backed by SnapTrade's aggregation API. Implements the
 * IBrokerProvider port, so the rest of the app (PortfolioService,
 * forecasting, UI) is unchanged. Per-user auth is carried as (snapTradeUserId,
 * userSecret); the clientId/consumerKey live on the shared SDK client.
 *
 * Holdings are fetched per linked account (the legacy aggregate `/holdings`
 * endpoint is retired) and aggregated across all of the user's accounts.
 */
export class SnapTradeProvider implements IBrokerProvider {
  private static readonly ACCOUNTS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
  private cachedAccountIds: string[] = [];
  private accountIdsExpiresAt = 0;

  constructor(private readonly cfg: SnapTradeProviderConfig) {}

  private async fetchAccountIds(): Promise<string[]> {
    const now = Date.now();
    if (this.cachedAccountIds.length > 0 && now < this.accountIdsExpiresAt) {
      return this.cachedAccountIds;
    }
    const res = await getSnapTradeClient().accountInformation.listUserAccounts({
      userId: this.cfg.snapTradeUserId,
      userSecret: this.cfg.userSecret,
    });
    const ids = ((res.data ?? []) as Array<{ id?: string }>)
      .map((a) => a.id)
      .filter((id): id is string => !!id);
    this.cachedAccountIds = ids;
    this.accountIdsExpiresAt = now + SnapTradeProvider.ACCOUNTS_CACHE_TTL_MS;
    return ids;
  }

  async getPositions(): Promise<Position[]> {
    const accountIds = await this.fetchAccountIds();
    const client = getSnapTradeClient();

    const perAccount = await Promise.allSettled(
      accountIds.map(async (accountId) => {
        const res = await client.accountInformation.getUserAccountPositions({
          userId: this.cfg.snapTradeUserId,
          userSecret: this.cfg.userSecret,
          accountId,
        });
        return (res.data ?? []) as SnapTradePositionLike[];
      }),
    );

    // Aggregate same-ticker positions across accounts, recomputing per-share
    // figures from summed cost basis / market value.
    const byTicker = new Map<string, Position & { _cost: number }>();
    for (const result of perAccount) {
      if (result.status !== "fulfilled") {
        console.warn("[SnapTradeProvider] positions fetch failed for an account:", result.reason);
        continue;
      }
      for (const raw of result.value) {
        if (raw.cash_equivalent) continue; // cash-like → counted in getCashBalance
        const mapped = mapSnapTradePosition(raw);
        if (!mapped || mapped.quantity === 0) continue;

        const cost = mapped.pricePaid * mapped.quantity;
        const existing = byTicker.get(mapped.ticker);
        if (existing) {
          existing.quantity += mapped.quantity;
          existing.marketValue += mapped.marketValue;
          existing.gainLoss += mapped.gainLoss;
          existing._cost += cost;
        } else {
          byTicker.set(mapped.ticker, { ...mapped, _cost: cost });
        }
      }
    }

    return Array.from(byTicker.values()).map(({ _cost, ...p }) => ({
      ...p,
      pricePaid: p.quantity !== 0 ? _cost / p.quantity : p.pricePaid,
      currentPrice: p.quantity !== 0 ? p.marketValue / p.quantity : p.currentPrice,
    }));
  }

  async getCashBalance(): Promise<number> {
    const accountIds = await this.fetchAccountIds();
    const client = getSnapTradeClient();

    const perAccount = await Promise.allSettled(
      accountIds.map(async (accountId) => {
        const res = await client.accountInformation.getUserAccountBalance({
          userId: this.cfg.snapTradeUserId,
          userSecret: this.cfg.userSecret,
          accountId,
        });
        return (res.data ?? []) as Array<{ cash?: number | null }>;
      }),
    );

    let cash = 0;
    for (const result of perAccount) {
      if (result.status !== "fulfilled") {
        console.warn("[SnapTradeProvider] balance fetch failed for an account:", result.reason);
        continue;
      }
      for (const b of result.value) cash += Number(b.cash ?? 0);
    }
    return cash;
  }
}
