/**
 * Headless cron worker — runs the four background crons (daily prediction
 * resolution, monthly recalibration, daily congress ingest, per-user agent
 * jobs) without booting Next.js. Meant to run 24/7 under pm2 (`pulse-worker`
 * app in ecosystem.config.cjs) on whichever machine owns the crons; the UI
 * server should then run with PULSE_CRONS=off so the schedules aren't armed
 * twice. See docs/headless-worker.md.
 *
 * Usage:
 *   npm run worker          → foreground (Ctrl-C to stop)
 *   npm run pm2:worker      → under pm2
 */
import { hydrateSecrets } from "../lib/secrets";
import { register } from "../instrumentation.node";

async function main() {
  await hydrateSecrets();
  await register();
  console.info(`[worker] Headless cron worker running (pid ${process.pid})`);
  // node-cron's timers keep the event loop alive; nothing else to do here.
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.info(`[worker] Received ${signal}, shutting down`);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] Fatal startup error:", err);
  process.exit(1);
});
