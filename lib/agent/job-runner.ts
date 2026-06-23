/**
 * Executor for per-user scheduled agent jobs (the `agent_jobs` table).
 *
 * A cron in instrumentation.node.ts calls runDueJobs() every few minutes. This
 * is the missing piece that makes the "Watching for you" scan toggles real and
 * delivers scheduled per-user sweeps (which in turn emit signal notifications).
 *
 * Single-process model (one pm2 worker, per CLAUDE.md): claiming via `claimed_at`
 * just guards against overlapping ticks, not a distributed worker pool.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { computeNextRun, type AgentJobKind } from "./scheduler";
import { runStockAgent } from "./sweep";
import { VERDICT_LABEL } from "@/types/news.types";
import { debug } from "../debug";

const DEFAULT_TZ = "America/New_York";
/** A claim older than this is considered stale (crashed mid-run) and reclaimable. */
const STALE_LOCK_MS = 30 * 60 * 1000;

interface AgentJobRow {
  id: string;
  user_id: string;
  kind: AgentJobKind;
  cron_expr: string;
}

type RunOutcome = { status: "ok" | "err"; summary: string };

async function runSweepJob(userId: string): Promise<RunOutcome> {
  const result = await runStockAgent(userId);
  const summary = `${result.totalBuys} ${VERDICT_LABEL.BUY} / ${result.totalSells} ${VERDICT_LABEL.SELL} across ${result.tickerResults.length} ticker(s)`;
  return { status: "ok", summary };
}

async function runCongressJob(): Promise<RunOutcome> {
  const { runCongressIngest } = await import("../congress/ingest");
  const result = await runCongressIngest({ logger: (m) => debug("agent", m) });
  const rows = (result.house?.rowsUpserted ?? 0) + (result.senate?.rowsUpserted ?? 0);
  return { status: "ok", summary: `Ingested ${rows} congressional trade row(s)` };
}

/**
 * Dispatch a single job by kind. The sweep-style kinds share one handler for v1
 * (they differ only in cadence/scope copy); `congress` runs the shared ingest.
 */
async function dispatch(job: AgentJobRow): Promise<RunOutcome> {
  switch (job.kind) {
    case "morning_digest":
    case "earnings_watch":
    case "concentration_risk":
    case "story_backlog":
      return runSweepJob(job.user_id);
    case "congress":
      return runCongressJob();
    default:
      return { status: "err", summary: `Unknown job kind: ${job.kind}` };
  }
}

async function tzForUser(sb: ReturnType<typeof createServiceClient>, userId: string): Promise<string> {
  const { data } = await sb.from("user_preferences").select("tz").eq("user_id", userId).maybeSingle();
  return ((data as { tz?: string } | null)?.tz as string) ?? DEFAULT_TZ;
}

/**
 * Find and run every job whose next_run_at has arrived. Best-effort and
 * non-throwing: one failing job is recorded and never blocks the others.
 * Returns the number of jobs run this tick.
 */
export async function runDueJobs(): Promise<number> {
  const sb = createServiceClient();
  const nowIso = new Date().toISOString();
  const staleIso = new Date(Date.now() - STALE_LOCK_MS).toISOString();

  const { data: due, error } = await sb
    .from("agent_jobs")
    .select("id, user_id, kind, cron_expr")
    .eq("enabled", true)
    .lte("next_run_at", nowIso)
    .or(`claimed_at.is.null,claimed_at.lt.${staleIso}`);

  if (error) {
    console.error("[job-runner] failed to query due jobs:", error.message);
    return 0;
  }
  const jobs = (due ?? []) as AgentJobRow[];
  if (jobs.length === 0) return 0;

  let ran = 0;
  for (const job of jobs) {
    // Claim so an overlapping tick doesn't double-run it.
    await sb.from("agent_jobs").update({ claimed_at: new Date().toISOString() }).eq("id", job.id);

    let outcome: RunOutcome;
    try {
      outcome = await dispatch(job);
    } catch (err) {
      outcome = { status: "err", summary: (err as Error).message.slice(0, 280) };
      console.error(`[job-runner] job ${job.kind} for ${job.user_id} failed:`, err);
    }

    const tz = await tzForUser(sb, job.user_id);
    const nextRun = computeNextRun(job.cron_expr, tz);
    await sb
      .from("agent_jobs")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: outcome.status,
        last_summary: outcome.summary,
        next_run_at: nextRun?.toISOString() ?? null,
        claimed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    ran++;
  }

  debug("agent", `[job-runner] ran ${ran} due job(s)`);
  return ran;
}
