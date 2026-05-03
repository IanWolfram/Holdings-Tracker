export interface HotTicker {
  ticker: string;
  companyName: string;
  currentPrice: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  heatScore: number;
}

export interface QuoteData {
  ticker: string;
  currentPrice: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  source: "yahoo" | "finnhub";
  fetchedAt: number;
}

export interface HistoryData {
  ticker: string;
  closes: number[];
  source: "yahoo" | "finnhub" | "polygon";
  fetchedAt: number;
}
