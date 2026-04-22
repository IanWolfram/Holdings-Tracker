export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Prevent duplicate cron registration in Dev/HMR
  if ((global as any)._worldCronScheduled) return;

  const { default: cron } = await import("node-cron");
  const { getPositionsSafe } = await import("../lib/etrade");
  const { getWorldData, invalidateWorldCache } = await import("../lib/world-data");

  const syncEnabled = process.env.WORLD_SYNC_ENABLED !== "false";
  const schedule = process.env.WORLD_CRON_SCHEDULE || "0 6-23 * * *";

  if (!syncEnabled) {
    console.info("[world-cron] Background sync is DISABLED via .env.local");
    return;
  }

  // Use configurable schedule
  cron.schedule(schedule, async () => {

    const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    try {
      console.info(`[world-cron] ${now} — starting scheduled world refresh`);
      
      // Use Safe version to handle token expiry gracefully
      const positions = await getPositionsSafe();
      
      invalidateWorldCache();
      await getWorldData(positions);
      
      console.info(`[world-cron] ${now} — refresh complete (${positions.length} positions)`);
    } catch (err) {
      console.error(`[world-cron] ${now} — critical failure:`, (err as Error).message);
    }
  });

  (global as any)._worldCronScheduled = true;
  console.info(`[world-cron] Service initialized: ${schedule}`);
}
