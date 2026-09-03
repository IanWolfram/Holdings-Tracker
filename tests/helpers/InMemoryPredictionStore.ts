import type { PredictionStore } from "@/lib/predictions/store";
import type { TickerPrediction } from "@/types/predictions";

/**
 * Map-backed PredictionStore double, keyed by prediction id (mirrors the table's
 * (user_id, id) PK within one tenant). Lets tests exercise the table-delegation
 * branch of the prediction functions without a database.
 */
export class InMemoryPredictionStore implements PredictionStore {
  private byId = new Map<string, TickerPrediction>();

  async load(ticker: string, horizon: number): Promise<TickerPrediction[]> {
    return [...this.byId.values()].filter((p) => p.ticker === ticker && p.horizonDays === horizon);
  }

  async save(_ticker: string, _horizon: number, predictions: TickerPrediction[]): Promise<void> {
    for (const p of predictions) this.byId.set(p.id, p); // upsert, never deletes
  }

  async append(prediction: TickerPrediction): Promise<void> {
    this.byId.set(prediction.id, prediction);
  }

  async allByTicker(): Promise<Record<string, TickerPrediction[]>> {
    const out: Record<string, TickerPrediction[]> = {};
    for (const p of this.byId.values()) (out[p.ticker] ??= []).push(p);
    return out;
  }

  async resolvedNonShadow(): Promise<TickerPrediction[]> {
    return [...this.byId.values()].filter((p) => p.status === "resolved" && !p.shadow);
  }

  async distinctTickers(): Promise<string[]> {
    return [...new Set([...this.byId.values()].map((p) => p.ticker))];
  }
}
