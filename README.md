# Pulse (Holdings Tracker)

Real-time, multi-tenant portfolio dashboard. Aggregates brokerage positions via SnapTrade, classifies news sentiment with DeepSeek, and runs a self-calibrating directional forecasting engine that scores its own past predictions. Next.js 16, React 19, Tailwind 4, Supabase (auth + Postgres), three.js.

**Features:** live positions (SnapTrade: E\*TRADE, Schwab, …) · BUY/SELL/HOLD news verdicts · 1/7/30-day forecasts with automatic resolution & recalibration · congressional-trade and insider signals · 3D globe sentiment view · Telegram alerts · Electron wrapper.

Architecture details live in [`CLAUDE.md`](CLAUDE.md); the knowledge graph (`graphify-out/`) maps the codebase.

---

## Quick Start

Requires Node 20+, a Supabase project, and API keys (DeepSeek, SnapTrade, Finnhub/Polygon/NewsAPI).

```bash
git clone https://github.com/IanWolfram/Holdings-Tracker.git
cd Holdings-Tracker && npm install
cp .env.example .env.local     # fill in what you have (vars documented there)
npm run dev                    # http://localhost:3000 → /terminal after login
```

Only the Supabase connection vars are required in `.env.local` — every other key can live in the `app_secrets` table, hydrated into the environment at boot (explicit `.env.local` values win). Link a brokerage via the Account panel's SnapTrade portal; until then the portfolio is empty but news/forecasts/congress signals still work.

**Routes:** `/terminal` (dashboard, default) · `/world` (3D globe) · `/hot` (trending) · `/agent` (sweeps, chat, forecasts).

---

## Running 24/7 — which process on which device

Pulse is two separable processes; only one needs to run around the clock.

| Process | What | Where |
|---|---|---|
| `pulse-worker` | Headless cron worker (`scripts/worker.ts`): daily prediction resolution 22:00 UTC, monthly recalibration, daily congress ingest 03:00 UTC, agent jobs every minute (incl. automatic story analysis — boosted to ~1 min latency while you're on the app). No Next/UI — tens of MB. | **Exactly one machine, 24/7.** An old laptop is ideal — all state is in Supabase. |
| `pulse` | The Next.js UI. | Whatever machine you're using, only while using it. |

The worker must never sleep (a suspended machine misses the 22:00 UTC resolve); the UI can come and go.

**Worker machine** (full runbook: [`docs/headless-worker.md`](docs/headless-worker.md)):

```bash
git clone <repo> && cd Holdings-Tracker && npm install
# .env.local: ONLY NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install -g pm2 && npm run pm2:worker
pm2 save && pm2 startup        # revive on reboot
```

Disable sleep, keep it on power, and `git pull && npm install && pm2 restart pulse-worker` when logic changes.

**UI machine:** run `PULSE_CRONS=off npm run dev` — a plain Next boot also arms the crons, and only one machine should own them (duplicates are harmless but double API/LLM spend). The pm2 `pulse` app sets this automatically.

**Everything on one machine:** `npm run pm2:start` (worker + UI, crons off on the UI), then `pm2 save && pm2 startup`.

pm2 helpers: `pm2:start` · `pm2:worker` · `pm2:status` · `pm2:logs` · `pm2:restart` · `pm2:stop`.

---

## CLI

```bash
npm run agent                # Full portfolio intelligence sweep
npm run worker               # Headless cron worker, foreground
npm run resolve:all          # Resolve every user's eligible predictions
npm run congress:ingest      # Pull new congressional trade disclosures
npm run world:refresh        # Force a 3D globe data refresh
npm run backfill             # Backfill calibration from historical predictions
npm run recalibrate          # Recompute sector rules (--apply to write)
npm run compare:forecasters  # A/B production vs. shadow forecaster
```

---

## Disclaimer

Tracking purposes only — no financial advice, no trade placement. Use at your own risk.

## License

Internal Project — All Rights Reserved.
