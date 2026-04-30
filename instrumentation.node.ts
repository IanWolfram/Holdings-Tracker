export async function register() {
  const globalState = global as Record<string, unknown>;
  if (globalState._worldCronScheduled) return;

  const { default: cron } = await import("node-cron");
  const { getPositionsSafe } = await import("./lib/etrade");
  const { getWorldData, invalidateWorldCache } = await import("./lib/world-data");
  const { getHistory } = await import("./lib/market-data");

  const syncEnabled = process.env.WORLD_SYNC_ENABLED !== "false";
  const schedule = process.env.WORLD_CRON_SCHEDULE || "0 6-23 * * *";

  if (!syncEnabled) {
    console.info("[world-cron] Background sync is DISABLED via .env.local");
    return;
  }

  cron.schedule(schedule, async () => {
    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    try {
      console.info(`[world-cron] ${now} — starting scheduled world refresh`);

      const positions = await getPositionsSafe();
      invalidateWorldCache();
      await getWorldData(positions);

      const warmed = await Promise.allSettled(
        positions.map((p) => getHistory(p.ticker, { awaitPolygon: true }))
      );
      const warmHits = warmed.filter(
        (r) => r.status === "fulfilled" && r.value !== null
      ).length;

      console.info(
        `[world-cron] ${now} — refresh complete (${positions.length} positions, ${warmHits} history cached)`
      );
    } catch (err) {
      console.error(`[world-cron] ${now} — critical failure:`, (err as Error).message);
    }
  });

  globalState._worldCronScheduled = true;
  console.info(`[world-cron] Service initialized: ${schedule}`);

  if (!globalState._recalibrateCronScheduled) {
    const { resolveVaultPath, WORLD_VAULT_PATH } = await import("./lib/constants");
    const { updateCalibration } = await import("./world-brain/calibration");
    const { spawn } = await import("child_process");

    cron.schedule("0 2 1 * *", async () => {
      try {
        console.info("[recalibrate-cron] Starting monthly recalibration…");
        const vaultPath = resolveVaultPath(WORLD_VAULT_PATH ?? "./world-vault") ?? "./world-vault";
        const report = updateCalibration(vaultPath);
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
    });

    globalState._recalibrateCronScheduled = true;
    console.info("[recalibrate-cron] Scheduled: 2am on the 1st of each month");
  }
}
