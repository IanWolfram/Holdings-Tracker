import type { NextApiResponse } from "next";
import { runTickerAnalysis, getTickerAnalysisProgress } from "../../../lib/agent/service";
import { requirePremiumAccess } from "@/lib/license";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET", "POST"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const access = await requirePremiumAccess();
  if (!access.ok) {
    return res.status(access.statusCode).json({ error: access.error });
  }

  if (req.method === "GET") {
    const ticker = (req.query.ticker as string)?.toUpperCase();
    if (!ticker) {
      return res.status(400).json({ error: "ticker query param required" });
    }
    const progress = getTickerAnalysisProgress(ticker);
    return res.status(200).json(progress ?? { ticker, status: "idle", articleIndex: 0, totalArticles: 0 });
  }

  if (req.method === "POST") {
    const { ticker } = req.body;
    if (!ticker || typeof ticker !== "string") {
      return res.status(400).json({ error: "ticker is required" });
    }
    const upperTicker = ticker.toUpperCase();

    // Check if already running
    const existing = getTickerAnalysisProgress(upperTicker);
    if (existing && existing.status === "running") {
      return res.status(409).json({ error: `Already analyzing ${upperTicker}` });
    }

    // Fire and forget
    runTickerAnalysis(upperTicker, user.id).catch((err) => {
      console.error(`[api/agent/run-ticker] Analysis failed for ${upperTicker}:`, err);
    });

    return res.status(202).json({ message: `Analysis started for ${upperTicker}` });
  }
}, "api/agent/run-ticker");
