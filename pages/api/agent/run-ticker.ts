import { NextApiRequest, NextApiResponse } from "next";
import { runTickerAnalysis, getTickerAnalysisProgress } from "../../../lib/agent/service";
import { requirePremiumAccess } from "@/lib/license";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const access = requirePremiumAccess();
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
    runTickerAnalysis(upperTicker).catch((err) => {
      console.error(`[api/agent/run-ticker] Analysis failed for ${upperTicker}:`, err);
    });

    return res.status(202).json({ message: `Analysis started for ${upperTicker}` });
  }

  return res.status(405).json({ error: "Method not allowed." });
}