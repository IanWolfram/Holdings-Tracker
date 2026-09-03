import type { NextApiResponse } from "next";
import { runStockAgent, getAgentProgress, cancelStockAgent } from "../../../lib/agent/service";
import { requirePremiumAccess } from "@/lib/license";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";
import { log } from "@/lib/logger";

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
    // No cooldown — the single-flight 409 above is the only gate. A sweep runs
    // until done (or until the user cancels via DELETE), and analyzed stories
    // are skipped on re-run, so back-to-back sweeps cost little.
    if (progress.status === "running") {
      return res.status(409).json({ error: "An agent run is already in progress." });
    }

    // Fire and forget (it updates global state) — but wait a beat before
    // returning 202. The cross-process sweep lock is claimed in the first few
    // awaits of runStockAgent; if a worker-side cron sweep already holds it,
    // the run rejects almost immediately and the client deserves a 409, not a
    // "started" that silently died in the background.
    const run = runStockAgent(user.id);
    run.catch((err) => {
      console.error("[api/agent/run] Background agent run failed:", err);
    });
    const EARLY_FAILURE_WINDOW_MS = 1_500;
    const earlyFailure = await Promise.race([
      run.then(
        () => null,
        (err: unknown) => (err instanceof Error ? err : new Error(String(err)))
      ),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), EARLY_FAILURE_WINDOW_MS)),
    ]);
    if (earlyFailure) {
      if (earlyFailure.message.includes("already in progress")) {
        return res.status(409).json({ error: "An agent run is already in progress." });
      }
      return res.status(500).json({ error: "Agent run failed to start." });
    }

    log.info("api/agent/run", `sweep started user=${user.id}`);
    return res.status(202).json({ message: "Agent run started." });
  }
}, "api/agent/run");
