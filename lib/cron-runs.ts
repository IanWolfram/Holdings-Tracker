/**
 * Durable cron last-run stamps (the `cron_runs` table).
 *
 * node-cron fires only while the worker is alive, so a tick that passes during
 * downtime is lost. Daily jobs self-heal next day; the monthly recalibration
 * would otherwise wait a month. These helpers let register() record completions
 * and detect a missed run at boot. Best-effort: a stamp failure never breaks the
 * cron it belongs to.
 */
import { createServiceClient } from "@/lib/supabase/server";

/** Record that `jobName` just completed. */
export async function stampCronRun(jobName: string): Promise<void> {
  try {
    const sb = createServiceClient();
    const { error } = await sb
      .from("cron_runs")
      .upsert({ job_name: jobName, last_ran_at: new Date().toISOString() }, { onConflict: "job_name" });
    if (error) console.error(`[cron-runs] stamp failed for ${jobName}:`, error.message);
  } catch (err) {
    console.error(`[cron-runs] stamp threw for ${jobName}:`, (err as Error).message);
  }
}

/** Last completion time for `jobName`, or null if never recorded / unreadable. */
export async function getLastCronRun(jobName: string): Promise<Date | null> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("cron_runs")
      .select("last_ran_at")
      .eq("job_name", jobName)
      .maybeSingle();
    if (error || !data?.last_ran_at) return null;
    return new Date(data.last_ran_at as string);
  } catch {
    return null;
  }
}
