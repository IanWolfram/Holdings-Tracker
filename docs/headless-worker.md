# Headless Cron Worker

`scripts/worker.ts` runs the four background crons (daily prediction resolution at 22:00 UTC, monthly recalibration, daily congress ingest at 03:00 UTC, per-user agent jobs every minute — including the on-by-default story analysis, which runs every 15 min baseline and every minute while the user is actively on the app) **without booting Next.js** — no UI, no page compilation, tens of MB of memory, near-zero idle CPU. It hydrates secrets from `app_secrets` and then calls the same `register()` in `instrumentation.node.ts` the Next server uses, so the schedules are identical.

All state lives in Supabase (predictions, calibration, congress trades, secrets), so the worker can run on any machine — including an old laptop — and the UI on your main machine just reads what the worker produced.

## Commands

```bash
npm run worker        # foreground, Ctrl-C to stop (good for testing)
npm run pm2:worker    # under pm2 as "pulse-worker" (worker only)
npm run pm2:start     # both pulse-worker and the production UI ("pulse")
npm run pm2:prod      # build + switch the UI to production mode ("pulse")
npm run pm2:dev       # switch the UI to dev mode with hot reload ("pulse-dev")
npm run pm2:deploy    # ship code changes to the running prod UI (build + restart)
```

Under pm2 the worker runs `scripts/worker.ts` directly via node with the tsx
loader (`--import tsx`), not through `npx tsx` — pm2 must supervise the real
worker process for `max_memory_restart` to see its actual memory. The
`pulse`/`pulse-dev` UI apps are mutually exclusive (both bind :3000); the
SwiftBar menu (`scripts/menubar/pulse.15s.sh`) toggles between them and
builds before switching to prod so a failed build never takes the UI down.

The boot log should print the schedule line:

```
[recalibrate-cron] Scheduled: monthly recalibration (2am UTC, 1st) + daily prediction resolution (22:00 UTC) + daily congress ingest (03:00 UTC) + per-user agent jobs (every minute)
[worker] Headless cron worker running (pid …)
```

## Avoiding duplicate crons: `PULSE_CRONS`

By default **every Next.js boot (dev included) arms the crons** via `src/instrumentation.ts`. When the worker owns the schedules, start the UI with `PULSE_CRONS=off` so it skips registration (the pm2 `pulse` and `pulse-dev` apps in `ecosystem.config.cjs` already set this). The jobs are idempotent, so a duplicate wouldn't corrupt data — but it doubles API/LLM spend, and the in-memory rate limiter assumes a single process.

**Rule: exactly one machine runs the worker.**

## Old-laptop setup

1. Clone the repo, install Node ≥ 20, `npm install`.
2. Create `.env.local` with only the two Supabase connection vars (everything else hydrates from `app_secrets`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=…
   SUPABASE_SERVICE_ROLE_KEY=…
   ```
3. `npm install -g pm2`, then:
   ```bash
   npm run pm2:worker
   pm2 save
   pm2 startup   # follow the printed command so pm2 revives on boot
   ```
4. Disable sleep / lid-close suspension and keep it on power — a sleeping laptop misses the 22:00 UTC resolve.
5. Keep it updated: `git pull && npm install && pm2 restart pulse-worker` whenever forecaster/ingest logic changes, or it keeps emitting predictions from the old recipe.
