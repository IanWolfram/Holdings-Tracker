/**
 * System-wide, impersonal forecasting track record for the public marketing page.
 *
 * Each user's vault holds a precomputed `_metrics/calibration.json`
 * (CalibrationReport). We sum those across every user into one aggregate — win
 * rate by horizon and by stated-confidence bucket — exposing ONLY counts and
 * rates, never tickers, users, or holdings. This is the "we grade our own calls
 * and show the receipts" proof; it is self-reported and unaudited (see the
 * disclaimer), and deliberately read-only and public.
 *
 * NOTE: we read each calibration.json directly rather than via
 * `loadCalibrationReport`, whose module-level cache is not keyed per user and
 * would return the first user's report for everyone in a loop.
 */
import { createServiceClient } from "./supabase/server";
import { getVaultStore } from "./vault/store";
import type { CalibrationReport, CalibrationStats } from "../world-brain/calibration";

export interface TrackRecordBucket {
  key: string;
  n: number;
  // Directional hit rate = (correct + partial) / n. PARTIAL means the predicted
  // direction was right but the move fell short of the predicted magnitude, so it
  // still counts as a correct *direction* call. `magnitudeRate` (correct / n) is
  // the stricter "also hit the target size" rate.
  winRate: number;
  magnitudeRate: number;
  avgConfidence: number;
}

export interface AggregateTrackRecord {
  updatedAt: string | null;
  totalResolved: number;
  overall: { n: number; correct: number; partial: number; incorrect: number; winRate: number; magnitudeRate: number };
  byHorizon: TrackRecordBucket[];
  byConfidenceBucket: TrackRecordBucket[];
}

interface Acc {
  n: number;
  correct: number;
  partial: number;
  incorrect: number;
  confidenceTotal: number;
}
const newAcc = (): Acc => ({ n: 0, correct: 0, partial: 0, incorrect: 0, confidenceTotal: 0 });

function fold(into: Map<string, Acc>, from: Record<string, CalibrationStats> | undefined): void {
  if (!from) return;
  for (const [key, s] of Object.entries(from)) {
    const a = into.get(key) ?? newAcc();
    a.n += s.n;
    a.correct += s.correct;
    a.partial += s.partial;
    a.incorrect += s.incorrect;
    a.confidenceTotal += s.avgConfidence * s.n; // recover the weighted total
    into.set(key, a);
  }
}

function toBuckets(map: Map<string, Acc>, sort: (a: TrackRecordBucket, b: TrackRecordBucket) => number): TrackRecordBucket[] {
  return [...map.entries()]
    .map(([key, a]) => ({
      key,
      n: a.n,
      winRate: a.n > 0 ? (a.correct + a.partial) / a.n : 0,
      magnitudeRate: a.n > 0 ? a.correct / a.n : 0,
      avgConfidence: a.n > 0 ? a.confidenceTotal / a.n : 0,
    }))
    .sort(sort);
}

let cache: { data: AggregateTrackRecord; expiresAt: number } | null = null;
const TTL_MS = 60 * 60 * 1000; // 1h — the resolution cron runs daily, so this is plenty fresh.

async function computeAggregate(): Promise<AggregateTrackRecord> {
  const supabase = createServiceClient();
  // Owners of a calibration report = users with ≥1 resolved prediction.
  const { data, error } = await supabase
    .from("vault_notes")
    .select("user_id")
    .eq("path", "_metrics/calibration.json");

  const empty: AggregateTrackRecord = {
    updatedAt: null,
    totalResolved: 0,
    overall: { n: 0, correct: 0, partial: 0, incorrect: 0, winRate: 0, magnitudeRate: 0 },
    byHorizon: [],
    byConfidenceBucket: [],
  };
  if (error || !data) return empty;

  const userIds = [...new Set(data.map((r) => r.user_id as string))];
  const horizon = new Map<string, Acc>();
  const confidence = new Map<string, Acc>();
  const overall = newAcc();
  let totalResolved = 0;
  let updatedAt: string | null = null;

  for (const userId of userIds) {
    try {
      const store = await getVaultStore(userId);
      const raw = await store.read("_metrics/calibration.json");
      if (!raw) continue;
      const report = JSON.parse(raw) as CalibrationReport;
      if (!report || typeof report !== "object" || !("totalResolved" in report)) continue;

      totalResolved += report.totalResolved ?? 0;
      if (report.updatedAt && (!updatedAt || report.updatedAt > updatedAt)) updatedAt = report.updatedAt;

      fold(horizon, report.byHorizon);
      fold(confidence, report.byConfidenceBucket);
      for (const s of Object.values(report.byHorizon ?? {})) {
        overall.n += s.n;
        overall.correct += s.correct;
        overall.partial += s.partial;
        overall.incorrect += s.incorrect;
      }
    } catch {
      continue; // one bad vault must not break the public page
    }
  }

  return {
    updatedAt,
    totalResolved,
    overall: {
      n: overall.n,
      correct: overall.correct,
      partial: overall.partial,
      incorrect: overall.incorrect,
      winRate: overall.n > 0 ? (overall.correct + overall.partial) / overall.n : 0,
      magnitudeRate: overall.n > 0 ? overall.correct / overall.n : 0,
    },
    // Horizons in numeric order (1d, 7d, 30d); confidence buckets ascending.
    byHorizon: toBuckets(horizon, (a, b) => parseInt(a.key) - parseInt(b.key)),
    byConfidenceBucket: toBuckets(confidence, (a, b) => a.key.localeCompare(b.key)),
  };
}

export async function getAggregateTrackRecord(): Promise<AggregateTrackRecord> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  const data = await computeAggregate();
  cache = { data, expiresAt: now + TTL_MS };
  return data;
}
