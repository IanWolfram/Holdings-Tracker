import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { resolveVaultPath } from "@/lib/constants";

export interface CalibrationStatusResponse {
  updatedAt: string | null;
  totalResolved: number;
}

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<CalibrationStatusResponse>
) {
  const vaultPathRaw = process.env.WORLD_VAULT_PATH ?? "./world-vault";
  const vaultPath = resolveVaultPath(vaultPathRaw) ?? vaultPathRaw;
  const calibrationPath = path.join(vaultPath, "_metrics", "calibration.json");

  if (!fs.existsSync(calibrationPath)) {
    return res.status(200).json({ updatedAt: null, totalResolved: 0 });
  }

  try {
    const data = JSON.parse(fs.readFileSync(calibrationPath, "utf-8"));
    return res.status(200).json({
      updatedAt: data.updatedAt ?? null,
      totalResolved: data.totalResolved ?? 0,
    });
  } catch {
    return res.status(200).json({ updatedAt: null, totalResolved: 0 });
  }
}
