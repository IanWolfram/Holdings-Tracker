import { NextApiRequest, NextApiResponse } from "next";
import { runStockAgent, getAgentProgress, cancelStockAgent } from "../../../lib/agent/service";
import { requirePremiumAccess } from "@/lib/license";
import { requireUser } from "@/lib/auth/requireUser";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireUser(req, res);
  if (!user) return;

  const access = await requirePremiumAccess();
  if (!access.ok) {
    return res.status(access.statusCode).json({ error: access.error });
  }

  if (req.method === "GET") {
    const progress = getAgentProgress();
    return res.status(200).json({
      ...progress,
      isMock: false
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
    runStockAgent(user.id).catch((err) => {
      console.error("[api/agent/run] Background agent run failed:", err);
    });

    return res.status(202).json({ message: "Agent run started." });
  }

  return res.status(405).json({ error: "Method not allowed." });
}
