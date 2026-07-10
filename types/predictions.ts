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
