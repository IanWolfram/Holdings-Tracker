import type { NextApiResponse } from "next";
import type { ClassifiedStory } from "@/types/news.types";
import { getServicesForUser } from "@/src/registry";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";
import { coerceAnalyzedAge, filterByAnalyzedAge } from "@/lib/analyzedAge";

export default apiHandler(["GET"], async (req, res: NextApiResponse<ClassifiedStory[] | { error: string }>) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const ticker = typeof req.query.ticker === "string" ? req.query.ticker.toUpperCase() : "";
  if (!ticker) {
    return res.status(400).json({ error: "ticker query param required" });
  }

  const { newsService, accountInfo } = await getServicesForUser(user.id);

  // The per-user NewsService caches the largest analyzed-age window; trim it to
  // this user's chosen age at response time so changing the setting takes effect
  // immediately (no cache miss). Pending/provider cards are always kept.
  // Resolve the age defensively — a preferences read failure must not break the
  // news endpoint, which otherwise degrades gracefully to cached results.
  let maxAge = coerceAnalyzedAge(undefined);
  try {
    const prefs = await accountInfo.getPreferences(user.id);
    maxAge = coerceAnalyzedAge(prefs.analyzedMaxAgeDays);
  } catch (err) {
    console.error("[/api/news] preferences read failed, using default age", err);
  }

  try {
    const deadline = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("news fetch timeout")), 20_000)
    );
    const stories = await Promise.race([newsService.getNewsForTicker(ticker), deadline]);
    res.status(200).json(filterByAnalyzedAge(stories, maxAge));
  } catch (err) {
    console.error("[/api/news]", err);
    // Fall back to whatever's in the cache — far better than a 5-minute spinner.
    const cached = newsService.getCachedNews(ticker);
    if (cached && cached.length > 0) {
      res.status(200).json(filterByAnalyzedAge(cached, maxAge));
      return;
    }
    res.status(504).json({ error: "Failed to fetch news" });
  }
}, "api/news");
