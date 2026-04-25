import type { NextApiRequest, NextApiResponse } from "next";
import { loadPredictions, getAllPredictions } from "../../world-brain/predictions";
import { WORLD_VAULT_PATH } from "../../lib/constants";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!WORLD_VAULT_PATH) {
    return res.status(200).json({ predictions: {} });
  }

  const { ticker } = req.query;

  if (typeof ticker === "string") {
    const predictions = loadPredictions(WORLD_VAULT_PATH, ticker.toUpperCase());
    return res.status(200).json({ predictions: { [ticker.toUpperCase()]: predictions } });
  }

  const predictions = getAllPredictions(WORLD_VAULT_PATH);
  return res.status(200).json({ predictions });
}
