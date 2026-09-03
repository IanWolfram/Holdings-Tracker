import type { NextApiResponse } from "next";
import { requireUserWithClient } from "@/lib/auth/requireUser";
import { SupabaseAccountInfoProvider } from "@/src/infrastructure/providers/SupabaseAccountInfoProvider";
import { apiHandler } from "@/lib/api-handler";
import { isTimescaleKey } from "@/lib/timescales";
import { isAnalyzedAge } from "@/lib/analyzedAge";

export default apiHandler(["PATCH"], async (req, res: NextApiResponse) => {
  // RLS-scoped: this only writes the caller's own user_preferences row, so build
  // a request-scoped provider on the user's JWT rather than the cached
  // (service-role) one from the registry.
  const { user, client } = await requireUserWithClient(req, res);
  if (!user || !client) return;

  const body = req.body as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (typeof body.cronOptIn === "boolean") patch.cronOptIn = body.cronOptIn;
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

  const accountInfo = new SupabaseAccountInfoProvider(client);
  const updated = await accountInfo.updatePreferences(user.id, patch);

  return res.status(200).json({
    cronOptIn: updated.cronOptIn,
    vaultEnabled: updated.vaultEnabled,
    defaultTimescale: updated.defaultTimescale,
    analyzedMaxAgeDays: updated.analyzedMaxAgeDays,
  });
}, "api/account/preferences");