/**
 * Prediction storage backend. Historically predictions lived as JSON blobs in
 * vault_notes (`predictions/<TICKER>-<H>d.json`); this abstraction lets the
 * Supabase path use the relational `predictions` table (single-row appends,
 * UPDATE-by-status resolution, SQL aggregates, no N+1 listing) while the
 * filesystem/in-memory vault stores keep the JSON path unchanged.
 *
 * A `VaultStore` exposes one of these via its optional `predictionStore()`
 * method; when it returns undefined the caller falls back to the JSON logic.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TickerPrediction } from "@/types/predictions";
import { tickerPredictionSchema } from "@/types/predictions";

export interface PredictionStore {
  /** All predictions for one ticker+horizon, newest first is NOT guaranteed. */
  load(ticker: string, horizon: number): Promise<TickerPrediction[]>;
  /** Upsert these rows (by id). Never deletes — matches the JSON callers, which
   *  only ever mutate-in-place or append, never drop an element. */
  save(ticker: string, horizon: number, predictions: TickerPrediction[]): Promise<void>;
  /** Insert one new prediction. */
  append(prediction: TickerPrediction): Promise<void>;
  /** Every prediction grouped by ticker (for the predictions API). */
  allByTicker(): Promise<Record<string, TickerPrediction[]>>;
  /** All resolved, non-shadow predictions (for calibration + metrics). */
  resolvedNonShadow(): Promise<TickerPrediction[]>;
  /** Distinct tickers that have any prediction (for the resolve cron). */
  distinctTickers(): Promise<string[]>;
}

// ── Row <-> TickerPrediction mapping ──

interface PredictionRow {
  user_id: string;
  id: string;
  ticker: string;
  horizon_days: number;
  run_at: number;
  status: string;
  direction: string;
  magnitude_pct: number;
  confidence: number;
  raw_confidence: number | null;
  reasoning: string;
  engine: string;
  version: string | null;
  shadow: boolean;
  source_url: string | null;
  synthetic: boolean | null;
  price_at_prediction: number;
  resolved_at: number | null;
  price_at_resolution: number | null;
  actual_pct: number | null;
  outcome: string | null;
  flat_band_pct: number | null;
  catalysts: unknown;
  catalyst_types: unknown;
}

function toRow(userId: string, p: TickerPrediction): Record<string, unknown> {
  return {
    user_id: userId,
    id: p.id,
    ticker: p.ticker,
    horizon_days: p.horizonDays,
    run_at: p.runAt,
    status: p.status,
    direction: p.direction,
    magnitude_pct: p.magnitudePct,
    confidence: p.confidence,
    raw_confidence: p.rawConfidence ?? null,
    reasoning: p.reasoning ?? "",
    engine: p.engine ?? "unknown",
    version: p.version ?? null,
    shadow: p.shadow ?? false,
    source_url: p.sourceUrl ?? null,
    synthetic: p.synthetic ?? null,
    price_at_prediction: p.priceAtPrediction,
    resolved_at: p.resolvedAt ?? null,
    price_at_resolution: p.priceAtResolution ?? null,
    actual_pct: p.actualPct ?? null,
    outcome: p.outcome ?? null,
    flat_band_pct: p.flatBandPct ?? null,
    catalysts: p.catalysts ?? [],
    catalyst_types: p.catalystTypes ?? null,
    updated_at: new Date().toISOString(),
  };
}

/** Build a TickerPrediction from a row, then validate. Returns null if the row
 *  fails the same schema loadPredictions applies to JSON — a corrupt row must
 *  not poison calibration whichever backend it came from. */
function fromRow(row: PredictionRow): TickerPrediction | null {
  const candidate: Record<string, unknown> = {
    id: row.id,
    ticker: row.ticker,
    runAt: row.run_at,
    priceAtPrediction: row.price_at_prediction,
    direction: row.direction,
    magnitudePct: row.magnitude_pct,
    horizonDays: row.horizon_days,
    confidence: row.confidence,
    reasoning: row.reasoning,
    catalysts: Array.isArray(row.catalysts) ? row.catalysts : [],
    engine: row.engine,
    status: row.status,
    shadow: row.shadow,
  };
  if (row.raw_confidence !== null) candidate.rawConfidence = row.raw_confidence;
  if (row.version !== null) candidate.version = row.version;
  if (row.source_url !== null) candidate.sourceUrl = row.source_url;
  if (row.synthetic !== null) candidate.synthetic = row.synthetic;
  if (row.resolved_at !== null) candidate.resolvedAt = row.resolved_at;
  if (row.price_at_resolution !== null) candidate.priceAtResolution = row.price_at_resolution;
  if (row.actual_pct !== null) candidate.actualPct = row.actual_pct;
  if (row.outcome !== null) candidate.outcome = row.outcome;
  if (row.flat_band_pct !== null) candidate.flatBandPct = row.flat_band_pct;
  if (Array.isArray(row.catalyst_types)) candidate.catalystTypes = row.catalyst_types;

  const result = tickerPredictionSchema.safeParse(candidate);
  return result.success ? (result.data as TickerPrediction) : null;
}

const PAGE = 1000;

export class SupabasePredictionStore implements PredictionStore {
  constructor(private userId: string, private db: SupabaseClient) {}

  /** Page past PostgREST's 1,000-row cap for prefix/where scans. */
  private async selectAll(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<PredictionRow[]> {
    const rows: PredictionRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await build(from, from + PAGE - 1);
      if (error || !data) break;
      rows.push(...(data as PredictionRow[]));
      if (data.length < PAGE) break;
    }
    return rows;
  }

  private mapValid(rows: PredictionRow[]): TickerPrediction[] {
    const out: TickerPrediction[] = [];
    let dropped = 0;
    for (const row of rows) {
      const p = fromRow(row);
      if (p) out.push(p);
      else dropped++;
    }
    if (dropped > 0) console.warn(`[predictions] Dropped ${dropped} corrupt prediction row(s) from table`);
    return out;
  }

  async load(ticker: string, horizon: number): Promise<TickerPrediction[]> {
    const rows = await this.selectAll((from, to) =>
      this.db
        .from("predictions")
        .select("*")
        .eq("user_id", this.userId)
        .eq("ticker", ticker)
        .eq("horizon_days", horizon)
        .order("run_at", { ascending: true })
        .range(from, to),
    );
    return this.mapValid(rows);
  }

  async save(_ticker: string, _horizon: number, predictions: TickerPrediction[]): Promise<void> {
    if (predictions.length === 0) return;
    const rows = predictions.map((p) => toRow(this.userId, p));
    const { error } = await this.db.from("predictions").upsert(rows, { onConflict: "user_id,id" });
    if (error) throw new Error(`Failed to save predictions: ${error.message}`);
  }

  async append(prediction: TickerPrediction): Promise<void> {
    // Single insert — no read-modify-write, so concurrent appends can't clobber.
    // upsert (not insert) keeps a re-emitted id idempotent rather than erroring.
    const { error } = await this.db
      .from("predictions")
      .upsert(toRow(this.userId, prediction), { onConflict: "user_id,id" });
    if (error) throw new Error(`Failed to append prediction: ${error.message}`);
  }

  async allByTicker(): Promise<Record<string, TickerPrediction[]>> {
    const rows = await this.selectAll((from, to) =>
      this.db
        .from("predictions")
        .select("*")
        .eq("user_id", this.userId)
        .order("run_at", { ascending: false })
        .range(from, to),
    );
    const grouped: Record<string, TickerPrediction[]> = {};
    for (const p of this.mapValid(rows)) {
      (grouped[p.ticker] ??= []).push(p);
    }
    return grouped;
  }

  async resolvedNonShadow(): Promise<TickerPrediction[]> {
    const rows = await this.selectAll((from, to) =>
      this.db
        .from("predictions")
        .select("*")
        .eq("user_id", this.userId)
        .eq("status", "resolved")
        .eq("shadow", false)
        .range(from, to),
    );
    return this.mapValid(rows);
  }

  async distinctTickers(): Promise<string[]> {
    const rows = await this.selectAll((from, to) =>
      this.db
        .from("predictions")
        .select("ticker")
        .eq("user_id", this.userId)
        .order("ticker", { ascending: true })
        .range(from, to),
    );
    return [...new Set(rows.map((r) => r.ticker))];
  }
}
