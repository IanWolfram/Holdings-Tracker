import { NextApiRequest, NextApiResponse } from "next";
import { fetchFullArticleContent } from "@/lib/jina";
import { analyzeStory } from "../../world-brain/brain";
import { getServices, getServicesForUser } from "@/src/registry";
import { writeStoryNote } from "../../world-brain/obsidian";
import { WORLD_VAULT_PATH } from "@/lib/constants";
import { FsVaultStore } from "@/lib/vault/store";
import { requirePremiumAccess } from "@/lib/license";
import { requireUser } from "@/lib/auth/requireUser";
import type { ClassifiedStory } from "@/types/news.types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUser(req, res);
  if (!user) return;

  const access = requirePremiumAccess();
  if (!access.ok) {
    return res.status(access.statusCode).json({ error: access.error });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { ticker, url, headline, summary } = req.body as {
    ticker?: string;
    url?: string;
    headline?: string;
    summary?: string;
  };

  if (!ticker || !url || !headline) {
    return res.status(400).json({ error: "ticker, url, and headline are required." });
  }

  // Fetch full article text via Jina — gracefully degrade to summary on failure
  const fullContent = await fetchFullArticleContent(url);
  const enrichedSummary = fullContent
    ? `${summary ?? ""}\n\n[Full Article]\n${fullContent.slice(0, 6000)}`
    : (summary ?? "");

  const store = WORLD_VAULT_PATH ? new FsVaultStore(WORLD_VAULT_PATH) : null;
  const analysis = await analyzeStory(store!, ticker, headline, enrichedSummary, [ticker]);

  // Patch in-memory cache so the UI sees the updated verdict immediately
  const { newsService } = process.env.PULSE_SINGLE_USER_MODE === "1"
    ? getServices()
    : await getServicesForUser(user.id);
  newsService.patchCachedStory(ticker, url, {
    verdict: analysis.verdict as ClassifiedStory["verdict"],
    confidence: analysis.confidence,
    reason: analysis.reason ?? undefined,
    isAnalyzed: true,
    classifiedAt: new Date().toISOString(),
  });

  // Persist to world-vault
  if (store) {
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
      store
    );
  }

  return res.status(200).json(analysis);
}
