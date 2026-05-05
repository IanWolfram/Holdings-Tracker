import type { INewsProvider, RawNewsItem } from "@/src/domain/interfaces/INewsProvider";
import { fetchPolygonNews } from "@/lib/polygon";

export class PolygonProvider implements INewsProvider {
  async fetchNews(ticker: string, companyName?: string): Promise<RawNewsItem[]> {
    try {
      const articles = await fetchPolygonNews(ticker, companyName);
      return articles.map((a) => ({
        headline: a.headline,
        summary: a.summary,
        url: a.url,
        datetime: a.datetime,
        source: "polygon",
      }));
    } catch (error) {
      console.error(`PolygonProvider error for ${ticker}:`, error);
      throw error;
    }
  }
}