import type { NextApiResponse } from "next";
import {
  loadPredictions,
  getAllPredictions,
  SUPPORTED_HORIZONS,
} from "../../world-brain/predictions";
import { getVaultStore } from "@/lib/vault/store";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET"], async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const store = await getVaultStore(user.id);
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