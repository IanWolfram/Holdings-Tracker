export type PredictionDirection = "UP" | "DOWN" | "FLAT";
export type PredictionStatus = "pending" | "resolved";
export type PredictionOutcome = "CORRECT" | "PARTIAL" | "INCORRECT";

export const FLAT_BAND_PCT = 1.0;
export const CORRECT_DIRECTION_MAGNITUDE_RATIO = 0.5;

export interface PredictionCatalyst {
  headline: string;
  verdict: string;
  confidence: number;
}

export interface TickerPrediction {
  id: string;
  ticker: string;
  runAt: number;
  priceAtPrediction: number;
  direction: PredictionDirection;
  magnitudePct: number;
  horizonDays: number;
  confidence: number;
  reasoning: string;
  catalysts: PredictionCatalyst[];
  engine: string;
  status: PredictionStatus;
  resolvedAt?: number;
  priceAtResolution?: number;
  actualPct?: number;
  outcome?: PredictionOutcome;
}
