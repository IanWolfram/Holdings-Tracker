import type { NextApiRequest, NextApiResponse } from "next";
import {
  loadPredictions,
  getAllPredictions,
  SUPPORTED_HORIZONS,
} from "../../world-brain/predictions";
import { WORLD_VAULT_PATH } from "../../lib/constants";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!WORLD_VAULT_PATH) {
    return res.status(200).json({ predictions: {} });
  }

  const { ticker } = req.query;

  const vaultPath = WORLD_VAULT_PATH;
  if (typeof ticker === "string") {
    const upper = ticker.toUpperCase();
    // Merge across all horizons so a per-ticker query mirrors the multi-horizon
    // shape that getAllPredictions returns; otherwise the API only surfaces 7d.
    const merged = SUPPORTED_HORIZONS.flatMap((horizon) =>
      loadPredictions(vaultPath, upper, horizon)
    ).sort((a, b) => b.runAt - a.runAt);
    return res.status(200).json({ predictions: { [upper]: merged } });
  }

  const predictions = getAllPredictions(WORLD_VAULT_PATH);
  return res.status(200).json({ predictions });
}
