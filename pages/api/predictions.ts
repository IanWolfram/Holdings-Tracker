import {
  loadPredictions,
  getAllPredictions,
  SUPPORTED_HORIZONS,
} from "../../world-brain/predictions";
import { getVaultStore } from "@/lib/vault/store";
import { requireUserWithClient } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";
import { rateLimit, PREDICTIONS_LIMIT } from "@/lib/rate-limit";

export default apiHandler(["GET"], async (req, res) => {
  // Read-only, caller's own predictions: RLS-scoped vault access.
  const { user, client } = await requireUserWithClient(req, res);
  if (!user || !client) return;

  const rl = rateLimit(`predictions:${user.id}`, PREDICTIONS_LIMIT);
  if (!rl.allowed) {
    res.setHeader("Retry-After", Math.ceil(rl.retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  const store = await getVaultStore(user.id, client);
  const { ticker } = req.query;

  if (typeof ticker === "string") {
    const upper = ticker.toUpperCase();
    const merged = (
      await Promise.all(
        SUPPORTED_HORIZONS.map((horizon) => loadPredictions(store, upper, horizon))
      )
    ).flat().sort((a, b) => b.runAt - a.runAt);
    return res.status(200).json({ predictions: { [upper]: merged } });
  }

  const predictions = await getAllPredictions(store);
  return res.status(200).json({ predictions });
}, "api/predictions");