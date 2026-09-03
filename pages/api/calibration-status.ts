import type { NextApiResponse } from "next";
import { getVaultStore } from "@/lib/vault/store";
import { loadCalibrationReport } from "../../world-brain/calibration";
import { requireUserWithClient } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";

export interface CalibrationStatusResponse {
  updatedAt: string | null;
  totalResolved: number;
}

export default apiHandler(["GET"], async (req, res: NextApiResponse<CalibrationStatusResponse | { error: string }>) => {
  // Read-only, caller's own calibration note: RLS-scoped so vault_notes access
  // is enforced by policy, not just the store's internal user_id filter.
  const { user, client } = await requireUserWithClient(req, res);
  if (!user || !client) return;

  const store = await getVaultStore(user.id, client);

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