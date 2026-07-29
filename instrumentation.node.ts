export async function register() {
  const globalState = global as Record<string, unknown>;
  if (globalState._recalibrateCronScheduled) return;

  const { default: cron } = await import("node-cron");
  const { SYSTEM_USER_ID } = await import("./lib/constants");
  const { updateCalibration } = await import("./world-brain/calibration");
  const { getVaultStore } = await import("./lib/vault/store");
  const { spawn } = await import("child_process");

  cron.schedule("0 2 1 * *", async () => {
    try {
      console.info("[recalibrate-cron] Starting monthly recalibration…");
      const store = await getVaultStore(SYSTEM_USER_ID);
      const report = await updateCalibration(store);
      console.info(`[recalibrate-cron] calibration.json updated — ${report.totalResolved} resolved predictions`);

      const child = spawn("npx", ["tsx", "scripts/recalibrate.ts", "--apply"], {
        cwd: process.cwd(),
        stdio: "inherit",
      });
      child.on("close", (code) => {
        if (code === 0) console.info("[recalibrate-cron] sector-rules.md provenance updated");
        else console.warn(`[recalibrate-cron] recalibrate script exited with code ${code}`);
      });
    } catch (err) {
      console.error("[recalibrate-cron] Failed:", (err as Error).message);
    }
  }, { timezone: "UTC" });

  // Daily prediction resolution — resolve every user's eligible predictions
  // against the horizon-date close so horizons stay accurate and nothing sits
  // pending until the user happens to run a sweep. 22:00 UTC is after the US
  // close; on days with no new bar the resolver is a harmless no-op.
  cron.schedule("0 22 * * *", async () => {
    try {
      const { resolveAllUsersPending } = await import("./world-brain/resolve-all");
      const { users, resolved, expired } = await resolveAllUsersPending();
      console.info(`[resolve-cron] Resolved ${resolved}, expired ${expired} prediction(s) across ${users} user(s)`);
    } catch (err) {
      console.error("[resolve-cron] Failed:", (err as Error).message);
    }
  }, { timezone: "UTC" });

  // Daily congressional-trade ingest — pull new House + Senate PTRs into the
  // shared `congress_trades` table. Incremental (skips already-logged filings),
  // so this is a light no-op on days with no new disclosures. 03:00 UTC keeps it
  // clear of the resolve (22:00) and recalibrate (02:00) jobs; the 30–45 day
  // STOCK Act filing lag makes daily cadence more than enough.
  cron.schedule("0 3 * * *", async () => {
    try {
      const { runCongressIngest } = await import("./lib/congress/ingest");
      const result = await runCongressIngest({ logger: (m) => console.info(m) });
      const rows = (result.house?.rowsUpserted ?? 0) + (result.senate?.rowsUpserted ?? 0);
      console.info(`[congress-cron] Ingested ${rows} trade row(s)`);
    } catch (err) {
      console.error("[congress-cron] Failed:", (err as Error).message);
    }
  }, { timezone: "UTC" });

  // Per-user scheduled agent jobs (the `agent_jobs` table behind the "Watching
  // for you" scan toggles, including the on-by-default story analysis). Ticks
  // every minute so the activity boost in runDueJobs() can analyze new stories
  // within ~1 min for users who are on the app; runDueJobs() runs only jobs
  // that are due or boosted, so this is a cheap no-op most ticks.
  cron.schedule("* * * * *", async () => {
    try {
      const { runDueJobs } = await import("./lib/agent/job-runner");
      const ran = await runDueJobs();
      if (ran > 0) console.info(`[jobs-cron] Ran ${ran} due agent job(s)`);
    } catch (err) {
      console.error("[jobs-cron] Failed:", (err as Error).message);
    }
  }, { timezone: "UTC" });

  // Stock-watch evaluation (the `stock_watches` price / verdict alert rules).
  // Every 2 minutes: responsive enough for price crossings while staying well
  // inside the Finnhub quote quota (quotes are deduped per distinct symbol).
  // A no-op when no user has any enabled watch.
  cron.schedule("*/2 * * * *", async () => {
    try {
      const { evaluateWatches } = await import("./lib/agent/watch-evaluator");
      const fired = await evaluateWatches();
      if (fired > 0) console.info(`[watch-cron] Fired ${fired} watch alert(s)`);
    } catch (err) {
      console.error("[watch-cron] Failed:", (err as Error).message);
    }
  }, { timezone: "UTC" });

  globalState._recalibrateCronScheduled = true;
  console.info("[recalibrate-cron] Scheduled: monthly recalibration (2am UTC, 1st) + daily prediction resolution (22:00 UTC) + daily congress ingest (03:00 UTC) + per-user agent jobs (every minute) + stock-watch alerts (every 2 min)");
}