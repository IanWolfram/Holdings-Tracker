import type { IBrokerProvider } from "@/src/domain/interfaces/IBrokerProvider";
import type { Position } from "@/types/position.types";

/**
 * Broker provider used when a user has no linked brokerage. Brokerage linking is
 * handled entirely through SnapTrade now; users without a SnapTrade connection
 * simply have an empty portfolio (rather than the old E*TRADE/mock fallback).
 */
export class NullBrokerProvider implements IBrokerProvider {
  async getPositions(): Promise<Position[]> {
    return [];
  }

  async getCashBalance(): Promise<number> {
    return 0;
  }
}
