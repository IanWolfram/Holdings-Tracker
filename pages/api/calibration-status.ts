import type { NextApiRequest, NextApiResponse } from "next";
import { WORLD_VAULT_PATH } from "@/lib/constants";
import { FsVaultStore } from "@/lib/vault/store";
import { loadCalibrationReport } from "../../world-brain/calibration";
import { requireUser } from "@/lib/auth/requireUser";

export interface CalibrationStatusResponse {
  updatedAt: string | null;
  totalResolved: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CalibrationStatusResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  if (!WORLD_VAULT_PATH) {
    return res.status(200).json({ updatedAt: null, totalResolved: 0 });
  }

  const store = new FsVaultStore(WORLD_VAULT_PATH);

  try {
    const data = await loadCalibrationReport(store);
    return res.status(200).json({
      updatedAt: data?.updatedAt ?? null,
      totalResolved: data?.totalResolved ?? 0,
    });
  } catch {
    return res.status(200).json({ updatedAt: null, totalResolved: 0 });
  }
}
