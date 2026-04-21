import type { IClassifier } from "@/src/domain/interfaces/IClassifier";
import type { Classification } from "@/types/news.types";
import { classifyNews } from "@/lib/classifier";

export interface ClassifierConfig {
  engine: string;
  mlx: {
    baseUrl: string;
    model: string;
  };
  ollama: {
    enabled: boolean;
    baseUrl: string;
    model: string;
  };
}

export class ClassifierService implements IClassifier {
  constructor(private readonly cfg: ClassifierConfig) {}

  async classify(ticker: string, headline: string, summary: string, url?: string): Promise<Classification> {
    return classifyNews(ticker, headline, summary, url);
  }
}
