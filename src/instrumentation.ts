export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Prevent duplicate cron registration in Dev/HMR
  if ((global as any)._worldCronScheduled) return;

  const { default: cron } = await import("node-cron");
  const { getPositionsSafe } = await import("../lib/etrade");
  const { getWorldData, invalidateWorldCache } = await import("../lib/world-data");
  const { getHistory } = await import("../lib/market-data");

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

      // Pre-warm the history cache the /api/positions route reads from.
      // Polygon's free tier serializes to ~12s/ticker, so we await this
      // fully — when the dashboard next polls, real history is ready.
      const warmed = await Promise.allSettled(
        positions.map((p) =>
          getHistory(p.ticker, { awaitPolygon: true })
        )
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

  (global as any)._worldCronScheduled = true;
  console.info(`[world-cron] Service initialized: ${schedule}`);
}
