# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pulse** (Holdings Tracker) — a real-time financial portfolio dashboard that aggregates E*TRADE positions, fetches news from Finnhub, Polygon, and NewsAPI, and classifies sentiment using a hardware-native Apple MLX AI engine. Built with Next.js 16 App Router, React 19, Tailwind CSS 4, SWR, and Framer Motion. Supports both single-user (Personal) and multi-tenant (Cloud) modes via Supabase Auth.

## Commands

```bash
npm run dev           # Start Next.js dev server (localhost:3000)
npm run build         # Production build
npm run lint          # ESLint via Next.js
npm run etrade:auth   # Interactive OAuth flow for E*TRADE tokens (Personal Mode only)
npm run agent         # CLI: Full portfolio intelligence analysis
npm run world:refresh # CLI: Force a 3D globe intelligence update
```

No test framework is configured. There are no test commands.

## Environment Modes

### Runtime Mode (`PULSE_SINGLE_USER_MODE`)

- `1` (Personal Mode) — No login. E*TRADE tokens in `.env.local`. Vault on disk. Same as pre-auth behavior.
- `0` or unset (Cloud Mode) — Full Supabase Auth. Per-user encrypted E*TRADE tokens. Vault in Postgres.

In Personal Mode, `requireUser()` returns a dev user and all auth/middleware is bypassed. The Electron app sets this env var based on the user's mode choice at first launch.

### E*TRADE Environment (`ETRADE_ENV`)

- `mock` — returns hardcoded positions and news without any API calls
- `sandbox` — uses E*TRADE sandbox API (requires OAuth tokens)
- `live` — uses E*TRADE production API (requires OAuth tokens)

When OAuth tokens are missing or expired, `getPositionsSafe()` automatically falls back to mock data with a console warning.

## Architecture

### Auth & Multi-Tenancy

```
Supabase Auth ──→ middleware.ts (Edge) ──→ redirects unauthenticated to /login
                       │
                       ▼
              lib/auth/requireUser.ts ──→ pages/api/* handlers get user.id
                       │
                       ▼
              src/registry.ts ──→ getServicesForUser(userId) ──→ per-user ETradeProvider + scoped caches
```

- **`middleware.ts`** — Edge middleware. Redirects unauthenticated users to `/login` (unless `PULSE_SINGLE_USER_MODE=1`). Public paths: `/login`, `/signup`, `/forgot-password`, `/reset`, `/check-email`, `/auth/callback`.
- **`lib/auth/requireUser.ts`** — API-route helper. Returns `User` or sends 401. In Personal Mode, returns `{ id: "dev-user-id", email: "dev@local" }`.
- **`lib/supabase/server.ts`** — Server-side Supabase client (reads cookies via `next/headers`).
- **`lib/supabase/browser.ts`** — Browser-side Supabase client (uses localStorage, persisted in Electron userData).
- **`app/(auth)/`** — Login, signup, forgot-password, reset, check-email pages. Signup includes Cloudflare Turnstile.
- **`app/auth/callback/route.ts`** — Exchanges `code` query param for session via `exchangeCodeForSession`.

### E*TRADE Token Storage

- **Personal Mode**: tokens in `.env.local`, read by `scripts/etrade-auth.mjs`. The script refuses to run unless `PULSE_SINGLE_USER_MODE=1`.
- **Cloud Mode**: tokens encrypted with AES-256-GCM (`lib/crypto/tokenCipher.ts`) and stored in `etrade_tokens` table in Supabase. Per-user. `key_version` column supports future key rotation.
- **`lib/etrade/tokens.ts`** — `loadUserTokens(userId)` / `saveUserTokens(userId, tok)` — the service-role client reads/writes encrypted tokens.

### Vault Storage

- **Personal Mode**: `FsVaultStore` — reads/writes markdown files to `WORLD_VAULT_PATH` on disk. Compatible with Obsidian.
- **Cloud Mode**: `SupabaseVaultStore` — reads/writes `vault_notes` table. JSONB frontmatter stays queryable. A future export endpoint can produce an Obsidian zip snapshot.
- **`lib/vault/store.ts`** — `VaultStore` interface with both implementations. `getVaultStore(userId)` returns the right one based on `PULSE_SINGLE_USER_MODE`.

### Data Flow

```
E*TRADE API ──→ lib/etrade.ts ──→ /api/positions ──→ Dashboard (SWR polling)
                                       │
Finnhub API ──→ lib/finnhub.ts ─┐
                                 ├→ NewsService ──→ /api/news?ticker=X ──→ PositionCard → NewsCard
Polygon API ──→ lib/polygon.ts ─┤        │
                                 └→ ClassifierService → world-brain/brain.ts (MLX) ──→ VerdictBadge
```

- **`pages/api/`** — All 23 API routes use `requireUser()` + `getServicesForUser()` to scope data per-user.
- **`src/registry.ts`** — `getServicesForUser(userId)` builds per-user services with E*TRADE tokens from Supabase and key-prefixed caches. `getServices()` (legacy singleton) for Personal Mode only.
- **SWR caching** — `MapCache` and `DiskCache` implement `getWithMeta()` returning `{ value, isStale }`. World data and news data serve stale results immediately while revalidating in the background. No more cron-driven prewarming.

### Cron Strategy

- **World refresh** and **news prewarm** crons have been **removed**. Data is fetched on-demand via SWR — stale data is served instantly, background revalidation kicks in when the TTL expires.
- **Recalibration cron** (monthly, 2am on the 1st) still runs, but only in `PULSE_SINGLE_USER_MODE=1`. In Cloud Mode, a future per-user worker will handle this based on `user_preferences.cron_opt_in`.
- **`instrumentation.node.ts`** — Only schedules the recalibrate cron in single-user mode. No more `node-cron` world/news schedules.

### Electron

- **`electron/main.js`** — On first launch, shows a mode chooser window (Personal vs Cloud). Choice is persisted in `userData/pulse-mode.json`. The chosen mode sets `PULSE_SINGLE_USER_MODE` env var for the spawned Next.js process.
- **Personal Mode**: spawns Next with `PULSE_SINGLE_USER_MODE=1`, opens `/world`. No auth, tokens in `.env.local`, vault on disk.
- **Cloud Mode**: spawns Next with `PULSE_SINGLE_USER_MODE=0`, opens `/login`. Full Supabase Auth, encrypted tokens, Postgres vault.
- **`electron/mode.js`**, **`modePrompt.html`**, **`modePreload.js`** — Mode chooser UI and logic.

### UI Components

- **`TopBar`** — Sticky header with brand, nav tabs (Terminal/Holdings/Analyst/Alerts), market status indicator, and refresh button.
- **`PositionCard`** — Card per ticker showing market value, P/L, and a verdict bar (proportional BUY/SELL/HOLD). Expandable news feed with show-more toggle.
- **`NewsCard`** — Heavily animated card using Framer Motion. Features physics-based SVG borders that react to mouse proximity.
- **`VerdictBadge`** — Color-coded BUY/SELL/HOLD badge with confidence percentage.
- **`ConnectionControls`** — E*TRADE connection status and re-authorize button (shows when tokens expire within 1 hour).

### Key Design Decisions

- **Dual routing**: App Router (`app/`) for the dashboard and auth pages, Pages Router (`pages/api/`) for API routes.
- **Tailwind CSS 4** with `@theme` directives in `globals.css` defining design tokens.
- **SWR caching**: `MapCache.getWithMeta()` returns `{ value, isStale }`. When stale, callers serve the cached value and kick off background revalidation. This replaces the old cron-driven prewarming.
- **Per-user cache scoping**: `getServicesForUser(userId)` prefixes cache keys with `u:<userId>:` rather than creating separate cache instances (avoids memory leak risk).
- **App-layer encryption** for E*TRADE tokens: AES-256-GCM with `ETRADE_TOKEN_ENC_KEY` env var. Not Supabase Vault — simpler, portable, `key_version` column enables rotation.

## External Dependencies

- **Supabase** — Auth (email+password with confirmation), Postgres (RLS-protected tables), and future Edge Functions.
- **Apple MLX** — Local inference server at `MLX_BASE_URL` (default `http://localhost:8080/v1`) with `MLX_MODEL`. Set `AI_ENGINE=mlx` in `.env.local`.
- **E*TRADE OAuth 1.0a** — Tokens expire daily at midnight ET. In Cloud Mode, re-authorize via `/api/etrade/auth` in the browser.
- **Cloudflare Turnstile** — Bot protection on `/signup`.

## Database Schema (Supabase)

Key tables (all RLS-protected, `auth.uid() = user_id`):

- `etrade_tokens` — Per-user encrypted OAuth tokens (AES-256-GCM, `key_version` for rotation).
- `etrade_request_tokens` — Short-lived OAuth request secrets (10-min TTL).
- `user_preferences` — AI model, vault enabled, cron opt-in.
- `vault_notes` — Markdown body + JSONB frontmatter. Unique on `(user_id, path)`.
- `user_activity` — Last seen, last refresh timestamps.

Bootstrap trigger `handle_new_user()` inserts default `user_preferences` + `user_activity` rows on signup.