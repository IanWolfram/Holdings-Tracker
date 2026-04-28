import type { ClassifiedStory, Verdict } from "@/types/news.types";

export type SentimentDirection = "bull" | "bear" | "flat";

export interface SentimentMetrics {
  // 0-100 Confidence-Weighted Conviction Score (CWCS)
  score: number;
  direction: SentimentDirection;
  // Confidence-weighted polarity in [-1, 1]
  polarity: number;
  // Confidence-weighted HOLD share in [0, 1]
  neutralDrag: number;
  // Sample-size reliability factor in [0, 1]
  reliability: number;
  // 0-100 average confidence across stories (normalized)
  avgConfidence?: number;
}

const EPSILON = 1e-9;
const RELIABILITY_DECAY = 6;
const DIRECTION_EPSILON = 0.025;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeConfidence(confidence: number | undefined): number {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return 0;
  }

  const normalized = confidence > 1 ? confidence / 100 : confidence;
  return clamp01(normalized);
}

function verdictToPolarity(verdict: Verdict): -1 | 0 | 1 {
  if (verdict === "BUY") return 1;
  if (verdict === "SELL") return -1;
  return 0;
}

/**
 * Confidence-Weighted Conviction Score (CWCS)
 *
 * P  = sum(confidence * polarity) / sum(confidence)
 * H  = confidence-weighted HOLD share
 * Nf = 1 - exp(-N / 6)
 *
 * score = 100 * |P| * (1 - H) * Nf
 */
export function calculateSentimentMetrics(stories: ClassifiedStory[]): SentimentMetrics {
  if (stories.length === 0) {
    return {
      score: 0,
      direction: "flat",
      polarity: 0,
      neutralDrag: 0,
      reliability: 0,
      avgConfidence: undefined,
    };
  }

  let weightedDirection = 0;
  let totalWeight = 0;
  let holdWeight = 0;
  let confidenceSum = 0;

  for (const story of stories) {
    const confidence = normalizeConfidence(story.confidence);
    const polarity = verdictToPolarity(story.verdict);

    weightedDirection += confidence * polarity;
    totalWeight += confidence;
    confidenceSum += confidence;

    if (polarity === 0) {
      holdWeight += confidence;
    }
  }

  const polarity = totalWeight > 0 ? weightedDirection / (totalWeight + EPSILON) : 0;
  const neutralDrag = totalWeight > 0 ? holdWeight / (totalWeight + EPSILON) : 0;
  const reliability = 1 - Math.exp(-stories.length / RELIABILITY_DECAY);

  const conviction = clamp01(Math.abs(polarity) * (1 - neutralDrag) * reliability);
  const direction: SentimentDirection =
    polarity > DIRECTION_EPSILON
      ? "bull"
      : polarity < -DIRECTION_EPSILON
      ? "bear"
      : "flat";

  return {
    score: conviction * 100,
    direction,
    polarity,
    neutralDrag,
    reliability,
    avgConfidence: (confidenceSum / stories.length) * 100,
  };
}