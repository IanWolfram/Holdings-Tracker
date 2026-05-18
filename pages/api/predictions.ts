import type { NextApiRequest, NextApiResponse } from "next";
import {
  loadPredictions,
  getAllPredictions,
  SUPPORTED_HORIZONS,
} from "../../world-brain/predictions";
import { getVaultStore } from "@/lib/vault/store";
import { requireUser } from "@/lib/auth/requireUser";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

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
}