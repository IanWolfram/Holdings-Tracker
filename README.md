# Pulse (Holdings Tracker)

Real-time, multi-tenant portfolio dashboard. Aggregates brokerage positions via SnapTrade, classifies news sentiment with DeepSeek, and runs a self-calibrating directional forecasting engine that scores its own past predictions. Next.js 16, React 19, Tailwind 4, Supabase (auth + Postgres), three.js.

**Features:** live positions (SnapTrade: E\*TRADE, Schwab, …) · BUY/SELL/HOLD news verdicts · 1/7/30-day forecasts with automatic resolution & recalibration · congressional-trade and insider signals · 3D globe sentiment view · Telegram alerts · Electron wrapper.

Architecture notes live in [`CLAUDE.md`](CLAUDE.md).

---

## Quick Start

Requires Node 20.19+ (22.13+ or 24 also fine — see `.nvmrc`), a Supabase project, and API keys (DeepSeek, SnapTrade, Finnhub/Polygon/NewsAPI).

```bash
git clone https://github.com/IanWolfram/Holdings-Tracker.git
cd Holdings-Tracker && npm install
cp .env.example .env.local     # fill in what you have (vars documented there)
npm run dev                    # http://localhost:3000 → /terminal after login
```

Only the Supabase connection vars are required in `.env.local` — every other key lives in the `app_secrets` table and is hydrated into the environment at boot (explicit `.env.local` values win). Link a brokerage via the Account panel's SnapTrade portal; until then the portfolio is empty but news, forecasts, and congress signals still work.

**Routes:** `/terminal` (dashboard, default) · `/world` (3D globe) · `/hot` (trending) · `/agent` (sweeps, chat, forecasts).

---

## Running 24/7

Pulse is two separable processes, and only one needs to run around the clock:

- **`pulse-worker`** — headless cron worker (`scripts/worker.ts`): prediction resolution, recalibration, congress ingest, agent jobs. No UI, tens of MB. Runs on **exactly one machine, 24/7** — all state is in Supabase, so an old laptop works. It must never sleep, or it misses the 22:00 UTC resolve.
- **`pulse`** — the Next.js UI. Runs wherever you are, only while you're using it.

```bash
npm run pm2:start              # worker + UI on one machine (crons off on the UI)
pm2 save && pm2 startup        # revive on reboot
```

Only one machine should own the crons — a plain Next boot arms them too, so set `PULSE_CRONS=off` on any extra UI (the pm2 `pulse` app does this for you). Duplicates are harmless but double API and LLM spend.

Full runbook: [`docs/headless-worker.md`](docs/headless-worker.md).

---

## CLI

```bash
npm run agent                # Full portfolio intelligence sweep
npm run worker               # Headless cron worker, foreground
npm run resolve:all          # Resolve every user's eligible predictions
npm run congress:ingest      # Pull new congressional trade disclosures
npm run world:refresh        # Force a 3D globe data refresh
npm run recalibrate          # Recompute sector rules (--apply to write)
npm run compare:forecasters  # A/B production vs. shadow forecaster
npm test                     # Vitest
```

---

## Disclaimer

Tracking purposes only — no financial advice, no trade placement. Use at your own risk.

## License

A personal project, published to show the work. No license granted — all rights reserved.
