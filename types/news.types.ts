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
  source: "finnhub" | "twitter" | "reddit" | "newsapi";
  relevanceScore?: number;  // 0-1 world-brain sector relevance score
  originCountry?: string;   // ISO alpha-2 code of the news geo-origin
}

export interface CongressTrade {
  id: string;
  politician: string;
  party: "D" | "R" | "I";
  chamber: "house" | "senate";
  ticker: string;
  companyName: string;
  tradeType: "buy" | "sell" | "buy_option" | "sell_option";
  assetType: string;   // "stock", "call option", "put option", etc.
  amount: string;      // "$1k–$15k", "$50k–$100k", etc.
  tradeDate: number;   // unix timestamp (seconds)
  filedDate: number;   // unix timestamp (seconds)
  url: string;
}
