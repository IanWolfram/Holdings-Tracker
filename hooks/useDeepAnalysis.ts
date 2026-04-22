import { useCallback, useState, type MouseEvent } from "react";
import type { ClassifiedStory } from "@/types/news.types";
import type { UnifiedAnalysis } from "@/world-brain/brain";

interface UseDeepAnalysisOptions {
  story: ClassifiedStory;
  onAnalyze?: (ticker: string, headline: string, summary: string) => void | Promise<void>;
}

export function useDeepAnalysis({ story, onAnalyze }: UseDeepAnalysisOptions) {
  const [analyzing, setAnalyzing] = useState(false);
  const [deepAnalysis, setDeepAnalysis] = useState<UnifiedAnalysis | null>(null);
  const canAnalyze = !analyzing && !deepAnalysis;

  const handleAnalyze = useCallback(
    async (event: MouseEvent) => {
      event.stopPropagation();
      if (!canAnalyze) return;

      if (onAnalyze) {
        setAnalyzing(true);
        try {
          await onAnalyze(story.ticker, story.headline, story.summary ?? "");
        } finally {
          setAnalyzing(false);
        }
        return;
      }

      setAnalyzing(true);
      try {
        const res = await fetch("/api/analyze-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticker: story.ticker,
            url: story.url,
            headline: story.headline,
            summary: story.summary ?? "",
          }),
        });
        if (res.ok) {
          const result: UnifiedAnalysis = await res.json();
          setDeepAnalysis(result);
        }
      } catch (err) {
        console.error("[NewsCard] Deep analyze failed:", err);
      } finally {
        setAnalyzing(false);
      }
    },
    [canAnalyze, onAnalyze, story]
  );

  return {
    analyzing,
    deepAnalysis,
    canAnalyze,
    handleAnalyze,
  };
}
