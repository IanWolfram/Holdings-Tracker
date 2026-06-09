# CLAUDE.md

## graphify

This project has a graphify knowledge graph at `graphify-out/graph.json` (868 nodes, 1571 edges, 46 communities). An MCP server is configured in `.mcp.json` providing live graph query tools.

**You MUST use the graphify MCP tools for codebase navigation instead of reading entire files.** This saves ~46x tokens per query.

### How to use graphify

Before reading source files to understand architecture or find connections, query the graph first:

- **`query_graph`** — "What connects to X?" Broad context. Use `mode="bfs"`, `depth=2-3`, `token_budget=1500`.
- **`get_node`** — "What is ETradeProvider?" Single node detail with source file and type.
- **`get_neighbors`** — "What does X import/call?" Direct connections of one node.
- **`get_community`** — "Show me the whole Auth cluster." All nodes in a community.
- **`shortest_path`** — "How does auth reach the dashboard?" Trace a dependency path.
- **`god_nodes`** — "What are the most important abstractions?" Hub nodes with the most connections.
- **`graph_stats`** — Quick summary of graph size and health.

### When to query vs read

- **Query the graph** when: exploring unfamiliar code, finding dependencies, tracing data flow, understanding how modules connect, answering "where is X used?".
- **Read source files** when: you need exact implementation details, are editing specific code, debugging a specific bug, or the graph doesn't cover what you need.

### Keep the graph updated

After adding new files, creating new components, or making significant architectural changes, run `/graphify --update` to re-extract only changed files and merge them into the graph. The git post-commit hook also auto-rebuilds on code commits.

This file guides Claude Code (claude.ai/code) when working in this repository. Keep it **navigational** — architecture-level truths and pointers, not exhaustive file lists (that's what graphify is for).

## Project Overview

**Pulse** (Holdings Tracker) — a real-time, multi-tenant financial portfolio dashboard. It aggregates E\*TRADE positions, fetches news from Finnhub, Polygon, and NewsAPI, classifies sentiment with the DeepSeek API, and runs a self-calibrating **directional forecasting** engine that scores its own past predictions. Built with Next.js 16 (App Router + Pages Router), React 19, Tailwind CSS 4, SWR, Framer Motion, and three.js (3D globe). Auth and storage are Supabase. There is **no single-user / offline mode** — every request is scoped to an authenticated Supabase user.

## Commands

```bash
npm run dev               # Next.js dev server (localhost:3000)
npm run build             # Production build
npm run lint              # ESLint (max-warnings 50)
npm run etrade:auth       # CLI OAuth flow for E*TRADE (alias: npm run eta)
npm run agent             # CLI: full portfolio intelligence sweep (scripts/agent.ts)
npm run world:refresh     # CLI: force a 3D globe intelligence update
npm run world:graph       # CLI: rebuild the world knowledge graph
npm run backfill          # CLI: backfill calibration from historical predictions
npm run recalibrate       # CLI: recompute sector rules from calibration (--apply to write)
npm run compare:forecasters  # CLI: A/B production vs. shadow forecaster versions
npm run pm2:start | pm2:status | pm2:logs | pm2:restart | pm2:stop
```

No test framework is configured. There are no test commands.

## Configuration & Secrets

Secrets (API keys, E\*TRADE consumer credentials, etc.) live in the Supabase **`app_secrets`** table — one source of truth across environments. `lib/secrets.ts` `hydrateSecrets()` reads them at server boot (from `src/instrumentation.ts`, Node runtime only) and copies them into `process.env`, so the rest of the app keeps reading `process.env.X`. **An explicitly-set env var (e.g. from `.env.local`) always wins** — hydration only fills keys that are unset.

CLI entry points (`scripts/agent.ts`, `world-refresh`) bypass instrumentation and must call `hydrateSecrets()` themselves. The Supabase connection vars (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) must stay in the real environment — they're needed to read `app_secrets` and so can't be sourced from it. Application/script code reads `process.env`; it must **not** parse `.env.local` itself. Let the runtime load it (e.g. `npx tsx --env-file=.env.local …`) so `process.env` is the single interface.

**Inspect the secrets:** `npx tsx --env-file=.env.local scripts/list-secrets.ts` lists every key in `app_secrets` (values masked; add `--reveal` to print them in full).

## E\*TRADE Environment (`ETRADE_ENV`)

- `mock` — hardcoded positions and news, no API calls
- `sandbox` — E\*TRADE sandbox API (requires OAuth tokens)
- `live` — E\*TRADE production API (requires OAuth tokens)

When OAuth tokens are missing or expired, the position path falls back to mock data with a console warning. Access tokens expire daily at midnight ET.

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

- **`middleware.ts`** — Edge middleware. Redirects unauthenticated users to `/login`. Public paths: `/login`, `/signup`, `/forgot-password`, `/reset`, `/check-email`, `/auth/callback`.
- **`lib/auth/requireUser.ts`** — API-route helper. Returns `User` or sends 401.
- **`lib/supabase/server.ts`** — server client (cookies via Pages-Router `req.headers`) + `createServiceClient()` for service-role access.
- **`lib/supabase/browser.ts`** — browser client (localStorage, persisted in Electron userData).
- **`app/(auth)/`** — login, signup, forgot-password, reset, check-email, etrade-verify. Signup uses Cloudflare Turnstile.
- **`app/auth/callback/route.ts`** — exchanges `code` for a session; validates `next` to block open redirects.

### Clean-architecture layering (`src/`)

- **`src/domain/interfaces/`** — ports: `IBrokerProvider`, `INewsProvider`, `IClassifier`, `ICache`, `IAccountInfoProvider`.
- **`src/infrastructure/providers/`** — adapters: `ETradeProvider`, `FinnhubProvider`, `PolygonProvider`, `NewsAPIProvider`, `SupabaseAccountInfoProvider`.
- **`src/services/`** — `PortfolioService`, `NewsService`, `ClassifierService` compose providers behind the interfaces.
- **`src/registry.ts`** — `getServicesForUser(userId)` builds per-user services with E\*TRADE tokens from Supabase and **key-prefixed** caches (`u:<userId>:`). `getServices()` is a legacy singleton for CLI/cron use only.

### Data Flow

```
E*TRADE API ──→ ETradeProvider ──→ /api/positions ──→ Dashboard (SWR polling)
                                        │
Finnhub / Polygon / NewsAPI ──→ NewsService ──→ /api/news?ticker=X ──→ PositionCard → NewsCard
                                        │
                                ClassifierService ──→ world-brain/brain.ts (DeepSeek) ──→ verdict bar
```

- **`pages/api/`** — all routes use `requireUser()` + `getServicesForUser()` to scope data per-user.
- **SWR caching** — `MapCache` / `DiskCache` implement `getWithMeta()` returning `{ value, isStale }`. World and news data serve stale results immediately while revalidating in the background. No cron-driven prewarming.

### AI / LLM layer

- **`lib/ai-config.ts`** — `getActiveModel()` currently resolves to **DeepSeek** (`deepseek-chat`, override via `DEEPSEEK_MODEL`). `getModelKey()` reads `DEEPSEEK_API_KEY`. `user_preferences.ai_model_id` is stored per-user but selection is not yet wired to swap providers at runtime.
- **`world-brain/brain.ts`** — `callLlm()` is the single LLM entry point. Base URL is `https://api.deepseek.com/v1` (or OpenAI's when the active provider is `openai`). System prompts are assembled from `world-brain/agents/*.md` + portfolio-agnostic static files; **per-user content (session insights) is never cached in a process-wide var** — that would leak one tenant's data to another.

### Market-data layer (`lib/marketdata/`)

- **`prices.ts`** — daily OHLC bars and detailed quotes via **Polygon** (`getDailyBars`, `getDetailedQuote`, `computeAtr14`). (`lib/stooq.ts` provides lightweight quotes used by `lib/market-data.ts`.)
- **`volatility.ts`** — ATR/flat-band math and bar lookup helpers (`findBarOnOrAfter`, `flatBandFromBars`) used to score predictions.
- **`macro.ts` / `events.ts`** — macro snapshot and earnings/event context fed into the forecaster.

### Predictions / Forecasting / Calibration  ← key subsystem

A self-scoring directional-forecast loop. The agent emits dated predictions, the system resolves them against the actual close at the horizon date, and calibration feeds back into the prompts.

- **`types/predictions.ts`** — `TickerPrediction`, `PredictionOutcome`, `CatalystType`; constants `FLAT_BAND_PCT`, `CORRECT_DIRECTION_MAGNITUDE_RATIO`. Supported horizons: **1, 7, 30 days**.
- **`lib/agent/forecast.ts`** — `runForecast()` synthesizes a ticker's news verdicts + macro + recent resolved outcomes into a directional prediction, using the `world-brain/agents/FORECASTER.md` prompt. Supports a **shadow v2** forecaster that records predictions without affecting production scoring (A/B promotion via `scripts/compare-forecaster-versions.ts`).
- **`world-brain/predictions.ts`** — load/save/append predictions (stored as `predictions/<TICKER>-<H>d.json` in the user's vault) and `resolveEligiblePredictions()` (scores pending predictions whose horizon close has arrived).
- **`world-brain/calibration.ts`** — `updateCalibration()` aggregates resolved outcomes into `calibration.json`; drives confidence/sector adjustments.
- **`world-brain/resolve-all.ts`** — multi-tenant batch resolution; resolves every user's eligible predictions from their prediction files (works even without live E\*TRADE tokens).
- **`lib/agent/sweep.ts`** — `runStockAgent()` orchestrates a full sweep: resolve prior predictions → analyze news → forecast each ticker across all horizons.
- **`instrumentation.node.ts`** — two crons: **daily prediction resolution** (22:00 UTC, after US close) and **monthly recalibration** (02:00 UTC on the 1st, then runs `scripts/recalibrate.ts --apply`).
- Surfaced via `pages/api/predictions.ts` and `pages/api/calibration-status.ts`.

### E\*TRADE token storage

- Tokens encrypted with AES-256-GCM (`lib/crypto/tokenCipher.ts`) and stored per-user in the `etrade_tokens` table. `key_version` supports future key rotation.
- **`lib/etrade/tokens.ts`** — `loadUserTokens(userId)` / `saveUserTokens(userId, tok)` via the service-role client.

### Vault storage

- **`SupabaseVaultStore`** (`lib/vault/store.ts`, `getVaultStore(userId)`) — reads/writes the `vault_notes` table; JSONB frontmatter stays queryable. Holds predictions, calibration, session insights, and world-brain notes.

### Electron

- **`electron/main.js`** — spawns Next.js and always opens `/login`; auth is required. (`electron/mode.js`, `modePrompt.html`, `modePreload.js` are a legacy mode chooser, no longer used.)

### UI

- App Router pages: `/terminal` (default; root redirects here), `/world` (3D globe), `/hot`, `/agent`, plus `app/(auth)/*`.
- **`TopBar`** — sticky header; nav tabs **Terminal / World / Hot / Agent**, market-status indicator, refresh, and the `AgentTrigger` sweep control.
- **`PositionCard`** — per-ticker market value, P/L, proportional BUY/SELL/HOLD verdict bar, expandable news feed.
- **`NewsCard`** — Framer Motion card with physics-based SVG borders reacting to mouse proximity.
- **3D globe** (`components/world/`) — three.js globe with per-country sentiment; hooks in `components/world/globe/`.

### Key Design Decisions

- **Dual routing**: App Router (`app/`) for UI/auth, Pages Router (`pages/api/`) for API.
- **Tailwind CSS 4** with `@theme` tokens in `app/globals.css`.
- **Per-user cache scoping** via key prefixes, not separate cache instances (avoids memory-leak risk).
- **App-layer encryption** for E\*TRADE tokens (AES-256-GCM, `ETRADE_TOKEN_ENC_KEY`), not Supabase Vault — simpler, portable, `key_version` enables rotation.
- **Forecaster A/B via shadow predictions** — a candidate version writes predictions that are scored but never shown, so promotion is data-driven.

## External Dependencies

- **Supabase** — Auth (email + password + confirmation), Postgres (RLS-protected), `app_secrets` config table.
- **DeepSeek API** — `https://api.deepseek.com/v1`, model `deepseek-chat` (override `DEEPSEEK_MODEL`). Requires `DEEPSEEK_API_KEY`. OpenAI is a supported alternate base URL in `brain.ts`.
- **E\*TRADE OAuth 1.0a** — tokens expire daily at midnight ET. Re-authorize via `/api/etrade/auth` in the browser, or `npm run etrade:auth` from the CLI.
- **News/market**: Finnhub, Polygon, NewsAPI. Extra signal sources: Congress trades and insider activity (`lib/insiders.ts` → `/api/congress`). Congress data comes from our own **official-source ingester** (`lib/congress/`: House Clerk PTRs + Senate eFD → parse → `@unitedstates/congress-legislators` roster join → Supabase `congress_trades`), refreshed by a daily cron and the `npm run congress:ingest` CLI. `lib/pelositracker.ts` is the legacy fallback (`CONGRESS_SOURCE=pelosi`); excess return is computed locally vs SPY. See `docs/congress-official-scraper-plan.md`. OCR for scanned/paper PTRs is deferred.
- **Cloudflare Turnstile** — bot protection on `/signup`.

## Database Schema (Supabase)

Key tables (RLS-protected, `auth.uid() = user_id` unless system-scoped):

- `etrade_tokens` — per-user encrypted OAuth tokens (`key_version` for rotation).
- `etrade_request_tokens` — short-lived OAuth request secrets (10-min TTL).
- `user_preferences` — `ai_model_id`, default timescale, vault enabled, cron opt-in.
- `vault_notes` — markdown body + JSONB frontmatter, unique on `(user_id, path)`.
- `user_activity` — last-seen / last-refresh timestamps.
- `app_secrets` — shared plaintext config (see Configuration & Secrets).
- `congress_trades` — parsed congressional PTR rows (shared/public, no `user_id`; authenticated read-only, service-role writes). `congress_ingest_log` — per-filing ingest status for incremental runs (service-role only).

Bootstrap trigger `handle_new_user()` inserts default `user_preferences` + `user_activity` rows on signup. Migrations live in `supabase/migrations/`.
