import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { createServiceClient } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/api-handler";
import { computeNextRun, type AgentJobKind } from "@/lib/agent/scheduler";

const DEFAULT_CRON: Record<AgentJobKind, string> = {
  morning_digest: "30 6 * * *",
  congress: "0 * * * *",
  story_backlog: "*/15 * * * *",
};

const DEFAULT_TZ = "America/New_York";

export default apiHandler(["GET", "PATCH"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const sb = createServiceClient();

  if (req.method === "GET") {
    const { data, error } = await sb
      .from("agent_jobs")
      .select("id, kind, cron_expr, enabled, last_run_at, next_run_at, last_status, last_summary")
      .eq("user_id", user.id)
      .order("kind", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ jobs: data ?? [] });
  }

  if (req.method === "PATCH") {
    const body = req.body as { kind?: string; enabled?: boolean; cron_expr?: string };
    const kind = body.kind as AgentJobKind | undefined;
    if (!kind || !(kind in DEFAULT_CRON)) {
      return res.status(400).json({ error: "Invalid or missing job kind." });
    }

    const { data: pref } = await sb
      .from("user_preferences")
      .select("tz")
      .eq("user_id", user.id)
      .single();
    const tz = (pref?.tz as string) ?? DEFAULT_TZ;

    const { data: existing } = await sb
      .from("agent_jobs")
      .select("cron_expr, enabled")
      .eq("user_id", user.id)
      .eq("kind", kind)
      .maybeSingle();

    const cronExpr = body.cron_expr ?? existing?.cron_expr ?? DEFAULT_CRON[kind];
    const enabled = body.enabled ?? existing?.enabled ?? false;
    const nextRun = enabled ? computeNextRun(cronExpr, tz) : null;

    const { data, error } = await sb
      .from("agent_jobs")
      .upsert(
        {
          user_id: user.id,
          kind,
          cron_expr: cronExpr,
          enabled,
          next_run_at: nextRun?.toISOString() ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,kind" },
      )
      .select("id, kind, cron_expr, enabled, last_run_at, next_run_at, last_status, last_summary")
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ job: data });
  }
}, "api/agent/jobs");