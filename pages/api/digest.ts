import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { sendUserDigest } from "@/lib/agent/digest";
import { apiHandler } from "@/lib/api-handler";

/**
 * On-demand "send me my digest now" for the authenticated user. Delivers to
 * their own linked Telegram chat (multi-tenant safe). The morning_digest cron
 * (lib/agent/job-runner.ts) sends the same digest on a schedule.
 */
export default apiHandler(
  ["POST"],
  async (req, res: NextApiResponse<{ success: boolean; sentAt?: string; skipped?: string }>) => {
    const user = await requireUser(req, res);
    if (!user) return;

    const result = await sendUserDigest(user.id);
    if (result.status === "skipped") {
      return res.status(200).json({ success: false, skipped: result.reason });
    }
    return res.status(200).json({ success: true, sentAt: new Date().toISOString() });
  },
  "api/digest",
);
