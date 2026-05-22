import type { NextApiResponse } from "next";
import { fetchFullArticleContent } from "@/lib/jina";
import { analyzeStory } from "../../world-brain/brain";
import { getServicesForUser } from "@/src/registry";
import { writeStoryNote } from "../../world-brain/obsidian";
import { MAX_ARTICLE_CONTENT_CHARS } from "@/lib/constants";
import { requireUser } from "@/lib/auth/requireUser";
import { getVaultStore } from "@/lib/vault/store";
import type { ClassifiedStory } from "@/types/news.types";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["POST"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { ticker, url, headline, summary } = req.body as {
    ticker?: string;
    url?: string;
    headline?: string;
    summary?: string;
  };

  if (!ticker || !url || !headline) {
    return res.status(400).json({ error: "ticker, url, and headline are required." });
  }

  let parsedUrl: URL;
  try { parsedUrl = new URL(url); } catch {
    return res.status(400).json({ error: "Invalid url." });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return res.status(400).json({ error: "Only http(s) URLs are accepted." });
  }

  // Fetch full article text via Jina — gracefully degrade to summary on failure
  const fullContent = await fetchFullArticleContent(url);
  const enrichedSummary = fullContent
    ? `${summary ?? ""}\n\n[Full Article]\n${fullContent.slice(0, MAX_ARTICLE_CONTENT_CHARS)}`
    : (summary ?? "");

  const analysis = await analyzeStory(ticker, headline, enrichedSummary, [ticker]);

  const { newsService } = await getServicesForUser(user.id);

  // Patch in-memory cache so the UI sees the updated verdict immediately
  newsService.patchCachedStory(ticker, url, {
    verdict: analysis.verdict as ClassifiedStory["verdict"],
    confidence: analysis.confidence,
    reason: analysis.reason ?? undefined,
    isAnalyzed: true,
    classifiedAt: new Date().toISOString(),
  });

  // Persist to vault (Supabase in cloud mode)
  const vaultStore = await getVaultStore(user.id);
  const now = Math.floor(Date.now() / 1000);
  await writeStoryNote(
    {
      ticker,
      headline,
      summary: summary ?? "",
      url,
      datetime: now,
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      reason: analysis.reason,
      source: "finnhub",
      originCountryCode: analysis.originCountryCode ?? undefined,
      relevanceScore: analysis.relevanceScore,
      isAnalyzed: true,
    },
    vaultStore,
  );

  return res.status(200).json(analysis);
}, "api/analyze-story");