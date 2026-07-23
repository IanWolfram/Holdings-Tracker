module.exports = {
  apps: [
    {
      // Headless cron worker — prediction resolution, recalibration, congress
      // ingest, agent jobs. No Next/UI; safe to run 24/7. Run this on exactly
      // ONE machine. See docs/headless-worker.md.
      //
      // Runs scripts/worker.ts directly under node (tsx registered via
      // --import) so pm2 measures the real worker process — the old
      // `npx tsx …` form made pm2 watch the npx wrapper, which let the child
      // sail past max_memory_restart unnoticed.
      name: "pulse-worker",
      script: "scripts/worker.ts",
      interpreter: "node",
      interpreter_args: "--env-file=.env.local --import tsx",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      max_memory_restart: "450M",
      env: {
        // Half the free-tier Polygon budget (5/min): worker + UI each pace to
        // ~2.3 calls/min so the two processes combined stay under the cap.
        POLYGON_RATE_MS: "26000",
      },
      out_file: ".pm2/logs/pulse-worker-out.log",
      error_file: ".pm2/logs/pulse-worker-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      // UI server, production mode — serves the output of `next build`.
      // PULSE_CRONS=off because pulse-worker owns the schedules — without it
      // every Next boot arms a second copy of the crons.
      // Deploy code changes with `npm run pm2:deploy` (build + restart), or
      // the SwiftBar menu's "Rebuild + Restart".
      name: "pulse",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "node",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        PULSE_CRONS: "off",
        POLYGON_RATE_MS: "26000",
      },
      out_file: ".pm2/logs/pulse-out.log",
      error_file: ".pm2/logs/pulse-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      // UI server, dev mode — hot reload for active development. Mutually
      // exclusive with "pulse" (both bind :3000); the SwiftBar dev/prod toggle
      // swaps between them. Never `pm2 start ecosystem.config.cjs` without
      // --only, or both UI apps will fight over the port.
      name: "pulse-dev",
      script: "node_modules/next/dist/bin/next",
      args: "dev",
      interpreter: "node",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      env: {
        NODE_ENV: "development",
        PULSE_CRONS: "off",
        POLYGON_RATE_MS: "26000",
      },
      out_file: ".pm2/logs/pulse-dev-out.log",
      error_file: ".pm2/logs/pulse-dev-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
