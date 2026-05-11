export async function register() {
  const globalState = global as Record<string, unknown>;
  if (globalState._recalibrateCronScheduled) return;

  const { default: cron } = await import("node-cron");
  const { WORLD_VAULT_PATH } = await import("./lib/constants");
  const { updateCalibration } = await import("./world-brain/calibration");
  const { FsVaultStore } = await import("./lib/vault/store");
  const { spawn } = await import("child_process");

  cron.schedule("0 2 1 * *", async () => {
    try {
      console.info("[recalibrate-cron] Starting monthly recalibration…");
      const store = new FsVaultStore(WORLD_VAULT_PATH ?? "./world-vault");
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
  });

  globalState._recalibrateCronScheduled = true;
  console.info("[recalibrate-cron] Scheduled: 2am on the 1st of each month (single-user mode)");
}