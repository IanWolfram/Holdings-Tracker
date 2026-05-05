export interface RawNewsItem {
  headline: string;
  summary: string;
  url: string;
  datetime: number;
  author?: string;
  source: "finnhub" | "polygon" | "newsapi";
}

export interface INewsProvider {
  fetchNews(ticker: string, companyName?: string, sector?: string): Promise<RawNewsItem[]>;
}
