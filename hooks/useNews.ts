import { useState, useCallback } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import type { ClassifiedStory } from "@/types/news.types";

export function useNews() {
  const [news, setNews] = useState<Record<string, ClassifiedStory[]>>({});
  const [loadingNews, setLoadingNews] = useState<Record<string, boolean>>({});

  // `silent` re-fetches in the background without toggling loadingNews — used
  // when the analyzed-age filter changes, so existing cards (and their glow)
  // stay put instead of flashing a loading state on a cheap server cache hit.
  const fetchNews = useCallback(async (tickers: string[], opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) {
      setLoadingNews(Object.fromEntries(tickers.map((ticker) => [ticker, true])));
    }
    await Promise.all(
      tickers.map(async (ticker) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 300_000);
        try {
          const res = await authedFetch(`/api/news?ticker=${ticker}`, { signal: controller.signal });
          if (!res.ok) return;
          const data: ClassifiedStory[] = await res.json();
          setNews((prev) => ({ ...prev, [ticker]: data }));
        } catch {
          // includes AbortError
        } finally {
          clearTimeout(timer);
          if (!silent) setLoadingNews((prev) => ({ ...prev, [ticker]: false }));
        }
      })
    );
  }, []);

  return { news, setNews, loadingNews, fetchNews };
}