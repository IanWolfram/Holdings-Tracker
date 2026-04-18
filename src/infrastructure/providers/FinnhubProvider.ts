import type { INewsProvider, RawNewsItem } from "@/src/domain/interfaces/INewsProvider";
import { fetchFinnhubNews } from "@/lib/finnhub";

export class FinnhubProvider implements INewsProvider {
  constructor(private readonly apiKey: string) {
    // Note: The lib/finnhub.ts implementation uses process.env.FINNHUB_API_KEY.
    // In this clean architecture provider, we might want to pass the apiKey,
    // but lib/finnhub.ts is already configured as a singleton for the app.
  }

  async fetchNews(ticker: string): Promise<RawNewsItem[]> {
    try {
      const articles = await fetchFinnhubNews(ticker);
      return articles.map((a) => ({
        headline: a.headline,
        summary: a.summary,
        url: a.url,
        datetime: a.datetime,
        source: "finnhub",
      }));
    } catch (error) {
      console.error(`FinnhubProvider error for ${ticker}:`, error);
      throw error;
    }
  }
}
