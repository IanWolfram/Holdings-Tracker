# Pulse (Holdings Tracker)

A real-time financial portfolio dashboard that aggregates E*TRADE positions, fetches news from Finnhub, Polygon, and NewsAPI, classifies sentiment using a hardware-native Apple MLX AI engine, and supports both **Personal Mode** (offline, single-user) and **Cloud Mode** (multi-tenant Supabase Auth). Built with Next.js 16, React 19, Tailwind CSS 4, SWR, and Framer Motion.

---

## Features

- **Real-time Portfolio Sync** — Live stock and option positions from E*TRADE, with automatic mock fallback.
- **News Aggregator** — Headlines from Finnhub, Polygon, and NewsAPI, classified by an AI Brain (BUY/SELL/HOLD + confidence + reason + geo-origin).
- **Stale-While-Revalidate Caching** — Dashboard data is served instantly from cache; background revalidation kicks in when TTL expires. No more cron-driven prewarming.
- **Multi-Tenant Auth** — Supabase email+password auth with per-user E*TRADE tokens (AES-256-GCM encrypted) and RLS-protected vault storage.
- **Personal Mode** — No login required. All data stays on-device. Obsidian-compatible vault on disk. Privacy-first.
- **Cloud Mode** — Sign up, link your E*TRADE account, access your portfolio from any device.
- **Electron Desktop App** — One-time mode chooser at first launch. Spawns Next.js locally in either mode.
- **3D Globe Intelligence View** — Geographic sentiment visualization with per-country BUY/SELL/HOLD scores.
- **Telegram Integration** — Alerts and digests via Telegram Bot API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router + Pages Router) |
| UI | React 19, Tailwind CSS 4, Framer Motion |
| Auth | Supabase Auth (email + password + confirmation) |
| Database | Supabase Postgres (RLS-protected per-user tables) |
| Encryption | AES-256-GCM (app-layer, `key_version` for rotation) |
| AI Engine | Apple MLX (DeepSeek-R1-Distill-Qwen on Apple Silicon) |
| Caching | MapCache / DiskCache with SWR (`getWithMeta`) |
| Desktop | Electron (Personal Mode or Cloud Mode) |
| Bot Protection | Cloudflare Turnstile on `/signup` |

---

## Getting Started

### Prerequisites

- **Hardware**: Apple Silicon (M1+) recommended for MLX inference.
- **Node.js** 18+ and npm.
- **Supabase project** (for Cloud Mode). Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
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

   Fill in API keys. Key variables:

   | Variable | Purpose |
   |---|---|
   | `PULSE_SINGLE_USER_MODE` | `1` for Personal Mode, `0` or unset for Cloud Mode |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-only, never bundled to client |
   | `ETRADE_TOKEN_ENC_KEY` | 32-byte hex key for AES-256-GCM token encryption |
   | `AI_ENGINE` | Set to `mlx` to activate hardware-native inference |

3. **Authenticate with E*TRADE** (Personal Mode only):

   ```bash
   npm run etrade:auth
   ```

   Follow the URL in the console, log in, and paste the verification code. Tokens expire daily at midnight ET.

   In Cloud Mode, E*TRADE authorization happens in the browser via `/api/etrade/auth`.

4. **Start the AI Brain** (optional, for MLX inference):

   ```bash
   ./scripts/mlx-server.sh   # Starts DeepSeek-R1 on port 8080
   ```

5. **Launch the dev server**:

   ```bash
   npm run dev                # http://localhost:3000
   ```

### Electron Desktop App

When launched via Electron, the app shows a one-time mode chooser:

- **Personal Mode** — Spawns Next.js with `PULSE_SINGLE_USER_MODE=1`. No login. Opens directly to `/world`.
- **Cloud Mode** — Full Supabase Auth. Opens to `/login`. E*TRADE tokens encrypted in the cloud.

The choice is stored in `userData/pulse-mode.json` and persists across launches.

---

## Architecture

### Auth Flow

```
/signup ──→ Supabase signUp ──→ email confirmation ──→ /auth/callback ──→ /world
/login  ──→ Supabase signIn ──→ session cookie ──→ middleware.ts ──→ protected routes
```

- `middleware.ts` (Edge runtime) enforces auth on all routes except `/login`, `/signup`, `/forgot-password`, `/reset`, `/check-email`, `/auth/callback`.
- In Personal Mode (`PULSE_SINGLE_USER_MODE=1`), middleware passes through without checking auth.
- API routes use `requireUser()` which returns a dev user in Personal Mode.

### SWR Caching

World data and news use a stale-while-revalidate pattern:

- `MapCache.getWithMeta()` returns `{ value, isStale }`.
- When data is fresh, it's served directly.
- When stale, the cached value is returned immediately and background revalidation is kicked off.
- No cron-driven prewarming. Data is fetched on-demand when users view the dashboard.

### E*TRADE Token Security

- **Personal Mode**: tokens in `.env.local`, read by `npm run etrade:auth`.
- **Cloud Mode**: tokens encrypted with AES-256-GCM (`lib/crypto/tokenCipher.ts`) and stored in `etrade_tokens` table. `key_version` column supports future key rotation.
- The `scripts/etrade-auth.mjs` CLI script refuses to run in Cloud Mode.

### Vault Storage

- **Personal Mode**: `FsVaultStore` — markdown files on disk at `WORLD_VAULT_PATH`. Compatible with Obsidian.
- **Cloud Mode**: `SupabaseVaultStore` — `vault_notes` table with JSONB frontmatter. A future export endpoint can produce an Obsidian zip snapshot.

---

## Intelligence Tools

### Stock Agent

Run a deep-intelligence sweep across your entire portfolio:

```bash
npm run agent
```

### World Intelligence Refresh

Force a 3D globe data refresh (requires dev server):

```bash
npm run world:refresh
```

Both tools use your live E*TRADE positions and require the MLX server.

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

Supabase tables (all RLS-protected, `auth.uid() = user_id`):

| Table | Purpose |
|---|---|
| `etrade_tokens` | Per-user encrypted OAuth tokens (AES-256-GCM) |
| `etrade_request_tokens` | Short-lived OAuth request secrets (10-min TTL) |
| `user_preferences` | AI model, vault enabled, cron opt-in |
| `vault_notes` | Markdown body + JSONB frontmatter, unique on `(user_id, path)` |
| `user_activity` | Last seen, last refresh timestamps |

A `handle_new_user()` trigger bootstraps default preferences and activity rows on signup.

---

## Disclaimer

This application is for **tracking purposes only**. It does not provide financial advice, nor does it allow for the placement of trades. Use at your own risk.

## License

Internal Project - All Rights Reserved.