import type { IClassifier } from "@/src/domain/interfaces/IClassifier";
import type { Classification } from "@/types/news.types";
import { classifyNews } from "@/lib/classifier";

export interface ClassifierConfig {
  engine: string;
  ollama: {
    enabled: boolean;
    baseUrl: string;
    model: string;
  };
}

export class ClassifierService implements IClassifier {
  constructor(
    private readonly cfg: ClassifierConfig,
    private readonly userId: string = "system",
  ) {}

  async classify(ticker: string, headline: string, summary: string, url?: string): Promise<Classification> {
    return classifyNews(ticker, headline, summary, url, this.userId);
  }
}
