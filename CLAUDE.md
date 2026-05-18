# CLAUDE.md

## graphify

This project has a graphify knowledge graph at `graphify-out/graph.json` (833 nodes, 1451 edges, 56 communities). An MCP server is configured in `.mcp.json` providing live graph query tools.

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
- **Read source files** when: you need the exact implementation details, editing specific code, debugging a specific bug, or the graph doesn't cover what you need.

### Keep the graph updated

After adding new files, creating new components, or making significant architectural changes, run `/graphify --update` to re-extract only changed files and merge them into the graph. The git post-commit hook also auto-rebuilds on code commits.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pulse** (Holdings Tracker) — a real-time financial portfolio dashboard that aggregates E\*TRADE positions, fetches news from Finnhub, Polygon, and NewsAPI, and classifies sentiment using the DeepSeek API. Built with Next.js 16 App Router, React 19, Tailwind CSS 4, SWR, and Framer Motion. Uses Supabase Auth for multi-tenant user management.

## Commands

```bash
npm run dev           # Start Next.js dev server (localhost:3000)
npm run build         # Production build
npm run lint          # ESLint via Next.js
npm run agent         # CLI: Full portfolio intelligence analysis
npm run world:refresh # CLI: Force a 3D globe intelligence update
```

No test framework is configured. There are no test commands.

## E\*TRADE Environment (`ETRADE_ENV`)

- `mock` — returns hardcoded positions and news without any API calls
- `sandbox` — uses E\*TRADE sandbox API (requires OAuth tokens)
- `live` — uses E\*TRADE production API (requires OAuth tokens)

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

- **`middleware.ts`** — Edge middleware. Redirects unauthenticated users to `/login`. Public paths: `/login`, `/signup`, `/forgot-password`, `/reset`, `/check-email`, `/auth/callback`.
- **`lib/auth/requireUser.ts`** — API-route helper. Returns `User` or sends 401.
- **`lib/supabase/server.ts`** — Server-side Supabase client (reads cookies via `next/headers`).
- **`lib/supabase/browser.ts`** — Browser-side Supabase client (uses localStorage, persisted in Electron userData).
- **`app/(auth)/`** — Login, signup, forgot-password, reset, check-email pages. Signup includes Cloudflare Turnstile.
- **`app/auth/callback/route.ts`** — Exchanges `code` query param for session via `exchangeCodeForSession`. Validates `next` param to prevent open redirects.

### E\*TRADE Token Storage

- Tokens encrypted with AES-256-GCM (`lib/crypto/tokenCipher.ts`) and stored in `etrade_tokens` table in Supabase. Per-user. `key_version` column supports future key rotation.
- **`lib/etrade/tokens.ts`** — `loadUserTokens(userId)` / `saveUserTokens(userId, tok)` — the service-role client reads/writes encrypted tokens.

### Vault Storage

- **`SupabaseVaultStore`** — reads/writes `vault_notes` table. JSONB frontmatter stays queryable. A future export endpoint can produce an Obsidian zip snapshot.
- **`lib/vault/store.ts`** — `VaultStore` interface. `getVaultStore(userId)` returns a `SupabaseVaultStore`.

### Data Flow

```
E*TRADE API ──→ lib/etrade.ts ──→ /api/positions ──→ Dashboard (SWR polling)
                                       │
Finnhub API ──→ lib/finnhub.ts ─┐
                                 ├→ NewsService ──→ /api/news?ticker=X ──→ PositionCard → NewsCard
Polygon API ──→ lib/polygon.ts ─┤        │
                                 └→ ClassifierService → world-brain/brain.ts (DeepSeek) ──→ VerdictBadge
```

- **`pages/api/`** — All API routes use `requireUser()` + `getServicesForUser()` to scope data per-user.
- **`src/registry.ts`** — `getServicesForUser(userId)` builds per-user services with E\*TRADE tokens from Supabase and key-prefixed caches. `getServices()` is a legacy singleton for CLI/cron use only.
- **SWR caching** — `MapCache` and `DiskCache` implement `getWithMeta()` returning `{ value, isStale }`. World data and news data serve stale results immediately while revalidating in the background.

### Electron

- **`electron/main.js`** — Spawns Next.js process and opens `/login`. Auth is required.
- **`electron/mode.js`**, **`modePrompt.html`**, **`modePreload.js`** — Legacy mode chooser UI (no longer used).

### UI Components

- **`TopBar`** — Sticky header with brand, nav tabs (Terminal/Holdings/Analyst/Alerts), market status indicator, and refresh button.
- **`PositionCard`** — Card per ticker showing market value, P/L, and a verdict bar (proportional BUY/SELL/HOLD). Expandable news feed with show-more toggle.
- **`NewsCard`** — Heavily animated card using Framer Motion. Features physics-based SVG borders that react to mouse proximity.
- **`VerdictBadge`** — Color-coded BUY/SELL/HOLD badge with confidence percentage.
- **`ConnectionControls`** — E\*TRADE connection status and re-authorize button (shows when tokens expire within 1 hour).

### Key Design Decisions

- **Dual routing**: App Router (`app/`) for the dashboard and auth pages, Pages Router (`pages/api/`) for API routes.
- **Tailwind CSS 4** with `@theme` directives in `globals.css` defining design tokens.
- **SWR caching**: `MapCache.getWithMeta()` returns `{ value, isStale }`. When stale, callers serve the cached value and kick off background revalidation.
- **Per-user cache scoping**: `getServicesForUser(userId)` prefixes cache keys with `u:<userId>:` rather than creating separate cache instances (avoids memory leak risk).
- **App-layer encryption** for E\*TRADE tokens: AES-256-GCM with `ETRADE_TOKEN_ENC_KEY` env var. Not Supabase Vault — simpler, portable, `key_version` column enables rotation.

## External Dependencies

- **Supabase** — Auth (email+password with confirmation), Postgres (RLS-protected tables), and future Edge Functions.
- **DeepSeek API** — Cloud LLM at `https://api.deepseek.com/v1`. Requires `DEEPSEEK_API_KEY` in `.env.local`. Model defaults to `deepseek-chat`; override with `DEEPSEEK_MODEL`.
- **E\*TRADE OAuth 1.0a** — Tokens expire daily at midnight ET. Re-authorize via `/api/etrade/auth` in the browser.
- **Cloudflare Turnstile** — Bot protection on `/signup`.

## Database Schema (Supabase)

Key tables (all RLS-protected, `auth.uid() = user_id`):

- `etrade_tokens` — Per-user encrypted OAuth tokens (AES-256-GCM, `key_version` for rotation).
- `etrade_request_tokens` — Short-lived OAuth request secrets (10-min TTL).
- `user_preferences` — AI model (`ai_model_id`), vault enabled, cron opt-in.
- `vault_notes` — Markdown body + JSONB frontmatter. Unique on `(user_id, path)`.
- `user_activity` — Last seen, last refresh timestamps.

Bootstrap trigger `handle_new_user()` inserts default `user_preferences` + `user_activity` rows on signup.
