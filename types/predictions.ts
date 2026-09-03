export type PredictionDirection = "UP" | "DOWN" | "FLAT";
/** "expired": pending past horizon + grace with no resolvable price data —
 *  removed from the pending pool without an outcome so it never poisons
 *  calibration and never sits pending forever. */
export type PredictionStatus = "pending" | "resolved" | "expired";
export type PredictionOutcome = "CORRECT" | "PARTIAL" | "INCORRECT";

export const CATALYST_TYPES = [
  "govt-contract",
  "analyst-upgrade",
  "analyst-downgrade",
  "earnings-beat",
  "earnings-miss",
  "earnings-revenue-decline",
  "regulatory",
  "m-and-a",
  "macro",
  "technical",
  "leadership",
  "product-launch",
  "partnership",
  "insider-activity",
  "other",
] as const;

export type CatalystType = (typeof CATALYST_TYPES)[number];

export const FLAT_BAND_PCT = 1.0;
export const CORRECT_DIRECTION_MAGNITUDE_RATIO = 0.5;

export interface PredictionCatalyst {
  headline: string;
  verdict: string;
  confidence: number;
  catalystTypes?: CatalystType[];
}

export interface TickerPrediction {
  id: string;
  ticker: string;
  runAt: number;
  priceAtPrediction: number;
  direction: PredictionDirection;
  magnitudePct: number;
  horizonDays: number;
  /** Calibration-grounded confidence actually shown in the UI: the raw model
   *  confidence shrunk toward the observed win rate of its bucket (shrink-only).
   *  See lib/agent/forecast.ts + world-brain/calibration.ts. */
  confidence: number;
  /** The model's stated confidence before reliability shrink. Kept for auditing
   *  calibration drift. Absent on predictions made before calibration was wired. */
  rawConfidence?: number;
  reasoning: string;
  catalysts: PredictionCatalyst[];
  catalystTypes?: CatalystType[];
  engine: string;
  /** Forecaster version label ("v1", "v2", …). Lets calibration and
   *  scripts/compare-forecaster-versions.ts separate predictions that share an
   *  engine model but come from different forecaster logic. */
  version?: string;
  /** Shadow predictions are evaluated against the same resolution price but kept
   *  out of the UI and live calibration — used to trial a new forecaster version. */
  shadow?: boolean;
  status: PredictionStatus;
  sourceUrl?: string;
  synthetic?: boolean;
  resolvedAt?: number;
  priceAtResolution?: number;
  actualPct?: number;
  outcome?: PredictionOutcome;
  /** Volatility-scaled FLAT band (percent) actually used to score this
   *  prediction at resolution. Recorded for auditability — a move within this
   *  band is treated as noise/FLAT rather than a directional outcome. Absent on
   *  predictions resolved under the legacy fixed ±FLAT_BAND_PCT rule. */
  flatBandPct?: number;
}

// ── Runtime validation ──
// Stored predictions feed the calibration loop forever, so a single corrupt row
// (a NaN price, a bad direction) can silently poison the model's self-scoring.
// This schema is deliberately STRICT on the fields the resolver and calibration
// depend on and LENIENT elsewhere (`.passthrough()` keeps unknown/newer fields):
// the aim is to drop genuinely broken rows, never to discard otherwise-valid
// predictions that predate a field. See loadPredictions in world-brain/predictions.ts.
import { z } from "zod";

const finiteNumber = z.number().refine(Number.isFinite, "must be a finite number");

const catalystSchema = z
  .object({
    headline: z.string().default(""),
    verdict: z.string().default(""),
    confidence: z.number().default(0),
    catalystTypes: z.array(z.enum(CATALYST_TYPES)).optional(),
  })
  .passthrough();

/** Validates ONE stored prediction. Critical fields are required + finite. */
export const tickerPredictionSchema = z
  .object({
    id: z.string().min(1),
    ticker: z.string().min(1),
    runAt: finiteNumber,
    priceAtPrediction: finiteNumber.refine((n) => n > 0, "price must be positive"),
    direction: z.enum(["UP", "DOWN", "FLAT"]),
    magnitudePct: finiteNumber,
    horizonDays: finiteNumber,
    confidence: finiteNumber,
    rawConfidence: finiteNumber.optional(),
    reasoning: z.string().default(""),
    catalysts: z.array(catalystSchema).default([]),
    catalystTypes: z.array(z.enum(CATALYST_TYPES)).optional(),
    engine: z.string().default("unknown"),
    version: z.string().optional(),
    shadow: z.boolean().optional(),
    status: z.enum(["pending", "resolved", "expired"]),
    sourceUrl: z.string().optional(),
    synthetic: z.boolean().optional(),
    resolvedAt: finiteNumber.optional(),
    priceAtResolution: finiteNumber.optional(),
    actualPct: finiteNumber.optional(),
    outcome: z.enum(["CORRECT", "PARTIAL", "INCORRECT"]).optional(),
    flatBandPct: finiteNumber.optional(),
  })
  .passthrough();

/**
 * Parse an unknown value into a clean TickerPrediction[]: keeps valid rows,
 * drops (and counts) corrupt ones. Never throws — corruption in one row must
 * not lose the rest of a ticker's history.
 */
export function parsePredictions(raw: unknown): { predictions: TickerPrediction[]; dropped: number } {
  if (!Array.isArray(raw)) return { predictions: [], dropped: 0 };
  const predictions: TickerPrediction[] = [];
  let dropped = 0;
  for (const item of raw) {
    const result = tickerPredictionSchema.safeParse(item);
    if (result.success) predictions.push(result.data as TickerPrediction);
    else dropped++;
  }
  return { predictions, dropped };
}
