import type { NextApiResponse } from "next";
import { getVaultStore } from "@/lib/vault/store";
import { loadCalibrationReport } from "../../world-brain/calibration";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";

export interface CalibrationStatusResponse {
  updatedAt: string | null;
  totalResolved: number;
}

export default apiHandler(["GET"], async (req, res: NextApiResponse<CalibrationStatusResponse | { error: string }>) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const store = await getVaultStore(user.id);

  try {
    const data = await loadCalibrationReport(store);
    return res.status(200).json({
      updatedAt: data?.updatedAt ?? null,
      totalResolved: data?.totalResolved ?? 0,
    });
  } catch {
    return res.status(200).json({ updatedAt: null, totalResolved: 0 });
  }
}, "api/calibration-status");