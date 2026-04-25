import { NextApiRequest, NextApiResponse } from "next";
import { runStockAgent, getAgentProgress, cancelStockAgent } from "../../../lib/agent/service";
import { requirePremiumAccess } from "@/lib/license";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const access = requirePremiumAccess();
  if (!access.ok) {
    return res.status(access.statusCode).json({ error: access.error });
  }

  if (req.method === "GET") {
    const progress = getAgentProgress();
    return res.status(200).json({
      ...progress,
      isMock: process.env.ETRADE_ENV === "mock"
    });
  }

  if (req.method === "DELETE") {
    cancelStockAgent();
    return res.status(200).json({ message: "Agent run cancelled." });
  }

  if (req.method === "POST") {
    const progress = getAgentProgress();
    if (progress.status === "running") {
      return res.status(409).json({ error: "An agent run is already in progress." });
    }

    // Fire and forget (it updates global state)
    // We don't await it here so we can return "Started" immediately
    runStockAgent().catch((err) => {
      console.error("[api/agent/run] Background agent run failed:", err);
    });

    return res.status(202).json({ message: "Agent run started." });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
