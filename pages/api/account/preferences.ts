import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";
import { apiHandler } from "@/lib/api-handler";
import { isTimescaleKey } from "@/lib/timescales";
import { isAnalyzedAge } from "@/lib/analyzedAge";

export default apiHandler(["PATCH"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const body = req.body as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (typeof body.cronOptIn === "boolean") patch.cronOptIn = body.cronOptIn;
  if (typeof body.aiModel === "string" || body.aiModel === null) patch.aiModel = body.aiModel;
  if (typeof body.vaultEnabled === "boolean") patch.vaultEnabled = body.vaultEnabled;
  if (body.defaultTimescale !== undefined) {
    if (!isTimescaleKey(body.defaultTimescale)) {
      return res.status(400).json({ error: "Invalid defaultTimescale" });
    }
    patch.defaultTimescale = body.defaultTimescale;
  }
  if (body.analyzedMaxAgeDays !== undefined) {
    if (!isAnalyzedAge(body.analyzedMaxAgeDays)) {
      return res.status(400).json({ error: "Invalid analyzedMaxAgeDays" });
    }
    patch.analyzedMaxAgeDays = body.analyzedMaxAgeDays;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const services = await getServicesForUser(user.id);
  const updated = await services.accountInfo.updatePreferences(user.id, patch);

  return res.status(200).json({
    cronOptIn: updated.cronOptIn,
    aiModel: updated.aiModel,
    vaultEnabled: updated.vaultEnabled,
    defaultTimescale: updated.defaultTimescale,
    analyzedMaxAgeDays: updated.analyzedMaxAgeDays,
  });
}, "api/account/preferences");