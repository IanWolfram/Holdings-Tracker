# Pulse (Holdings Tracker)

A real-time, multi-tenant financial portfolio dashboard. Pulse aggregates E*TRADE positions, pulls news from Finnhub, Polygon, and NewsAPI, classifies sentiment with the DeepSeek API, and runs a self-calibrating **directional forecasting** engine that scores its own past predictions and feeds the results back into its prompts. Built with Next.js 16, React 19, Tailwind CSS 4, SWR, Framer Motion, and three.js.

---

## Features

- **Real-time Portfolio Sync** — Live stock and option positions from E*TRADE, with automatic mock fallback when tokens are missing or expired.
- **News Aggregator** — Headlines from Finnhub, Polygon, and NewsAPI, classified by the AI Brain (BUY/SELL/HOLD + confidence + reason + geo-origin).
- **Directional Forecasting & Self-Calibration** — The agent emits dated 1/7/30-day predictions, automatically resolves them against the real close at the horizon date, and recalibrates confidence and sector rules over time. A shadow "v2" forecaster can run in parallel for data-driven A/B promotion.
- **Stale-While-Revalidate Caching** — Dashboard data is served instantly from cache; background revalidation runs when the TTL expires.
- **Multi-Tenant Auth** — Supabase email + password auth with per-user E*TRADE tokens (AES-256-GCM encrypted) and RLS-protected vault storage. Every request is scoped to an authenticated user.
- **3D Globe Intelligence View** — Geographic sentiment visualization with per-country BUY/SELL/HOLD scores.
- **Extra Signal Sources** — Congressional trade disclosures and insider activity layered into the analysis.
- **Telegram Integration** — Alerts and digests via the Telegram Bot API.
- **Electron Desktop App** — Wraps the dashboard in a native window (auth still required).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router + Pages Router) |
| UI | React 19, Tailwind CSS 4, Framer Motion, three.js |
| Auth | Supabase Auth (email + password + confirmation) |
| Database | Supabase Postgres (RLS-protected per-user tables) |
| AI Engine | DeepSeek API (`deepseek-chat`; OpenAI supported as an alternate provider) |
| Market Data | Polygon (OHLC bars + quotes), Finnhub, NewsAPI |
| Encryption | AES-256-GCM (app-layer, `key_version` for rotation) |
| Caching | MapCache / DiskCache with SWR (`getWithMeta`) |
| Desktop | Electron |
| Bot Protection | Cloudflare Turnstile on `/signup` |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm.
- **Supabase project** — set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- **DeepSeek API key** — for sentiment classification and forecasting.
- **E*TRADE Developer Account** — Consumer Key and secret.

### Installation

1. **Clone and install**:

   ```bash
   git clone https://github.com/IanWolfram/Holdings-Tracker.git
   cd Holdings-Tracker
   npm install
   ```

2. **Configure environment**:

   ```bash
   cp .env.example .env.local
   ```

   Fill in the keys you have. Key variables:

   | Variable | Purpose |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only, never bundled to client |
   | `ETRADE_TOKEN_ENC_KEY` | 32-byte hex key for AES-256-GCM token encryption |
   | `ETRADE_CONSUMER_KEY` / `ETRADE_CONSUMER_SECRET` | E*TRADE developer credentials |
   | `ETRADE_ENV` | `mock`, `sandbox`, or `live` |
   | `DEEPSEEK_API_KEY` | DeepSeek API key (override model with `DEEPSEEK_MODEL`) |
   | `FINNHUB_API_KEY` / `NEWSAPI_API_KEY` | News sources |

   > **Note on secrets:** Most API keys can also live in the Supabase `app_secrets` table, which is hydrated into the environment at server boot. Anything you set explicitly in `.env.local` always takes precedence, so local overrides remain authoritative. The Supabase connection vars above must stay in `.env.local` (they're used to read `app_secrets`).

3. **Authenticate with E*TRADE**:

   ```bash
   npm run etrade:auth
   ```

   Follow the URL in the console, log in, and paste the verification code. Access tokens expire daily at midnight ET. In the browser, re-authorization happens via `/api/etrade/auth`.

4. **Start the dev server**:

   ```bash
   npm run dev                # http://localhost:3000
   ```

   The app opens at `/terminal` after login.

---

## App Routes

| Route | Description |
|---|---|
| `/terminal` | Main dashboard — positions, P/L, verdicts (default). |
| `/world` | 3D globe with per-country sentiment. |
| `/hot` | Hot/trending intelligence view. |
| `/agent` | Agent console — sweeps, chat, forecasts. |

---

## Architecture

### Auth Flow

```
/signup ──→ Supabase signUp ──→ email confirmation ──→ /auth/callback ──→ /terminal
/login  ──→ Supabase signIn ──→ session cookie ──→ middleware.ts ──→ protected routes
```

`middleware.ts` (Edge runtime) enforces auth on all routes except `/login`, `/signup`, `/forgot-password`, `/reset`, `/check-email`, `/auth/callback`. API routes use `requireUser()` and scope all data per-user via `getServicesForUser(userId)`.

### SWR Caching

World and news data use a stale-while-revalidate pattern. `MapCache.getWithMeta()` returns `{ value, isStale }`; fresh data is served directly, stale data is returned immediately while a background revalidation runs. No cron-driven prewarming.

### Forecasting & Calibration

The stock agent synthesizes each ticker's news verdicts, a macro snapshot, and recently resolved outcomes into directional predictions at 1-, 7-, and 30-day horizons (`world-brain/agents/FORECASTER.md` prompt). Predictions are stored per-user, then resolved against the actual close at the horizon date and aggregated into a calibration report. Two background jobs keep this honest:

- **Daily prediction resolution** — 22:00 UTC (after the US close).
- **Monthly recalibration** — 02:00 UTC on the 1st, which also refreshes sector rules.

### E*TRADE Token Security

Tokens are encrypted with AES-256-GCM (`lib/crypto/tokenCipher.ts`) and stored per-user in the `etrade_tokens` table. The `key_version` column supports future key rotation.

---

## Intelligence Tools (CLI)

```bash
npm run agent                # Full portfolio intelligence sweep (analyze + forecast + resolve)
npm run world:refresh        # Force a 3D globe data refresh
npm run backfill             # Backfill calibration from historical predictions
npm run recalibrate          # Recompute sector rules from calibration (--apply to write)
npm run compare:forecasters  # A/B production vs. shadow forecaster versions
```

---

## Running with pm2

```bash
npm run pm2:start      # start under pm2
npm run pm2:status     # check status
npm run pm2:logs       # tail logs
npm run pm2:restart    # restart after config changes
npm run pm2:stop       # stop
```

Auto-start on login:

```bash
pm2 save && pm2 startup
```

---

## Database Schema

Supabase tables (RLS-protected, `auth.uid() = user_id` unless system-scoped):

| Table | Purpose |
|---|---|
| `etrade_tokens` | Per-user encrypted OAuth tokens (AES-256-GCM, `key_version`) |
| `etrade_request_tokens` | Short-lived OAuth request secrets (10-min TTL) |
| `user_preferences` | AI model, default timescale, vault enabled, cron opt-in |
| `vault_notes` | Markdown body + JSONB frontmatter (predictions, calibration, insights), unique on `(user_id, path)` |
| `user_activity` | Last seen, last refresh timestamps |
| `app_secrets` | Shared config/API keys hydrated into the environment at boot |

A `handle_new_user()` trigger bootstraps default preferences and activity rows on signup. Migrations live in `supabase/migrations/`.

---

## Disclaimer

This application is for **tracking purposes only**. It does not provide financial advice, nor does it allow for the placement of trades. Use at your own risk.

## License

Internal Project - All Rights Reserved.
