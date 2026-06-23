import type { NextApiResponse } from "next";
import { runStockAgent, getAgentProgress, cancelStockAgent } from "../../../lib/agent/service";
import { requirePremiumAccess } from "@/lib/license";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";
import { SWEEP_COOLDOWN_MS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

// Per-user time of the last sweep we started. In-memory is fine for a single
// pm2 process; it resets on restart (worst case: one extra sweep after deploy).
const lastSweepAt = new Map<string, number>();

export default apiHandler(["GET", "DELETE", "POST"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const access = await requirePremiumAccess();
  if (!access.ok) {
    return res.status(access.statusCode).json({ error: access.error });
  }

  if (req.method === "GET") {
    const progress = getAgentProgress(user.id);
    return res.status(200).json({
      ...progress,
      isMock: false
    });
  }

  if (req.method === "DELETE") {
    cancelStockAgent(user.id);
    return res.status(200).json({ message: "Agent run cancelled." });
  }

  if (req.method === "POST") {
    const progress = getAgentProgress(user.id);
    if (progress.status === "running") {
      return res.status(409).json({ error: "An agent run is already in progress." });
    }

    // Cooldown: a sweep calls DeepSeek per ticker per horizon, so cap how often
    // one user can trigger it (on top of the single-flight 409 above).
    const last = lastSweepAt.get(user.id);
    if (last && Date.now() - last < SWEEP_COOLDOWN_MS) {
      const waitS = Math.ceil((SWEEP_COOLDOWN_MS - (Date.now() - last)) / 1000);
      res.setHeader("Retry-After", waitS);
      return res.status(429).json({
        error: `Sweep on cooldown. Try again in ${waitS}s.`,
      });
    }
    lastSweepAt.set(user.id, Date.now());
    log.info("api/agent/run", `sweep started user=${user.id}`);

    // Fire and forget (it updates global state)
    // We don't await it here so we can return "Started" immediately
    runStockAgent(user.id).catch((err) => {
      console.error("[api/agent/run] Background agent run failed:", err);
    });

    return res.status(202).json({ message: "Agent run started." });
  }
}, "api/agent/run");
