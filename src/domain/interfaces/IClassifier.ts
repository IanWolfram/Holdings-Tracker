import type { Classification } from "@/types/news.types";

export interface IClassifier {
  classify(ticker: string, headline: string, summary: string): Promise<Classification>;
}
