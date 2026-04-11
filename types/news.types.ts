export type Verdict = "BUY" | "SELL" | "HOLD";

export interface Classification {
  verdict: Verdict;
  confidence: number;
  reason?: string;
  classifiedAt: string;
}

export interface ClassifiedStory extends Classification {
  ticker: string;
  headline: string;
  summary: string;
  url: string;
  datetime: number;
  author?: string;
  source: "finnhub" | "twitter";
}
