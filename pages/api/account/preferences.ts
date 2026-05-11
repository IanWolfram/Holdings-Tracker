import { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const body = req.body as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (typeof body.cronOptIn === "boolean") patch.cronOptIn = body.cronOptIn;
  if (typeof body.aiModel === "string" || body.aiModel === null) patch.aiModel = body.aiModel;
  if (typeof body.vaultEnabled === "boolean") patch.vaultEnabled = body.vaultEnabled;

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const services = await getServicesForUser(user.id);
  const updated = await services.accountInfo.updatePreferences(user.id, patch);

  return res.status(200).json({
    cronOptIn: updated.cronOptIn,
    aiModel: updated.aiModel,
    vaultEnabled: updated.vaultEnabled,
  });
}