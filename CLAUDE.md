# CLAUDE.md

Guidance for AI coding agents (Claude Code) working in this repo. Humans should start with `README.md`.

Keep this file **navigational**: non-obvious truths and gotchas only. Anything you can learn by reading the code belongs in the code, not here. **This repo is public**, so this file is too. Machine-specific or personal notes go in `CLAUDE.local.md` (gitignored).

## Project Overview

**Pulse** (Holdings Tracker) — real-time, multi-tenant financial portfolio dashboard. Aggregates brokerage positions via SnapTrade, classifies news sentiment with DeepSeek, and runs a self-calibrating directional forecasting engine that scores its own past predictions. Next.js 16 (App Router + Pages Router), React 19, Tailwind 4, SWR, three.js. Auth and storage are Supabase.

**There is no single-user or offline mode.** Every request is scoped to an authenticated Supabase user.

## Public repo: secret hygiene

- Never commit secrets. `.env*.local` is gitignored; real keys live in Supabase `app_secrets` (see Gotchas).
- Never hardcode a key in `.mcp.json` or any other tracked config. Reference an env var (`${VAR}`) instead.
- Don't add personal paths, emails, or machine names to tracked files.

## Codebase navigation (optional, local only)

If `graphify-out/graph.json` exists, a graphify knowledge graph and its MCP server (`graphify` in `.mcp.json`) are available. **Prefer the graphify MCP tools over reading whole files** when exploring architecture or answering "where is X used?". It costs roughly 46x fewer tokens. Read source directly when you need exact implementation details, are editing, or are debugging.

Tools: `query_graph`, `get_node`, `get_neighbors`, `get_community`, `shortest_path`, `god_nodes`, `graph_stats`. `graphify-out/` is untracked (rebuilt by a local post-commit hook, or `/graphify --update`), so a fresh clone won't have it. Fall back to normal search.

## Commands

```bash
npm run dev               # Next dev server (localhost:3000)
npm run build             # Production build
npm run lint              # ESLint (max-warnings 50)
npm test                  # Vitest (watch: npm run test:watch)
npm run worker            # Headless cron worker — see docs/headless-worker.md
npm run agent             # Full portfolio intelligence sweep
npm run resolve:all       # Resolve every user's eligible predictions
npm run congress:ingest   # Pull new congressional trade disclosures
npm run recalibrate       # Recompute sector rules (--apply to write)
npm run compare:forecasters  # A/B production vs. shadow forecaster
npm run pm2:start | pm2:prod | pm2:dev | pm2:deploy | pm2:worker | pm2:status | pm2:logs | pm2:restart | pm2:stop
```

Test coverage is intentionally narrow: the pure seams of the forecasting/calibration loop and shared utilities, backed by in-memory doubles in `tests/helpers/`. UI and provider adapters are deliberately uncovered — they churn too fast to pay rent.

## Gotchas

These are the things that cause real mistakes.

**Crons must run in exactly one process.** `scripts/worker.ts` (pm2 `pulse-worker`) is the intended 24/7 host, but *any* Next boot also arms them unless `PULSE_CRONS=off` is set. Duplicate crons are harmless but double API/LLM spend. The pm2 `pulse`/`pulse-dev` UI apps set the flag; a bare `npm run dev` does not.

**Secrets come from Supabase `app_secrets`, never from parsing `.env.local`.** `lib/secrets.ts` `hydrateSecrets()` copies them into `process.env` at boot; app code just reads `process.env.X`. An explicitly-set env var always wins — hydration only fills unset keys. Two consequences:
- CLI entry points bypass instrumentation and **must call `hydrateSecrets()` themselves**.
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must stay in the real environment — they're needed to *read* `app_secrets`, so they can't come from it.

Hydration runs **once at boot**. If the database was unreachable at startup, the process holds no API keys and will not recover on its own — restart it.

Inspect with `npx tsx --env-file=.env.local scripts/list-secrets.ts` (`--reveal` to unmask).

**Never cache per-user content in a process-wide variable.** This is multi-tenant; a module-level cache of session insights or prompts leaks one tenant's data to another. Caches are per-user and key-prefixed (`u:<userId>:`) via `src/registry.ts`, held in an LRU-capped registry.

**`ETRADE_TOKEN_ENC_KEY` is the generic secret-encryption key.** The name is historical — the E\*TRADE OAuth flow is gone and SnapTrade is the only broker. It seals SnapTrade user secrets (AES-256-GCM, `lib/crypto/bytea.ts`). Carrying it over verbatim is required for any environment move, or sealed secrets won't unseal.

**Unpaginated Supabase selects silently truncate at 1,000 rows.** Paginate with `.range()` — see `selectAllByPrefix`.

**Sweeps take a cross-process lock.** Manual sweeps run in the Next process while cron sweeps run in the worker, so the in-memory guard can't see across them. `lib/agent/run-lock.ts` claims a row in `sweep_locks` with heartbeats and a 30-minute stale threshold. Note that `scripts/worker.ts` exits on SIGINT via `process.exit(0)`, which skips the release — a lock held at shutdown stays orphaned until it goes stale.

**Dual routing:** App Router (`app/`) for UI and auth, Pages Router (`pages/api/`) for API. Not a migration in progress — it's the convention.

**DeepSeek is the only runtime model.** `lib/ai-config.ts` resolves it; `world-brain/brain.ts` `callLlm()` is the single entry point. The `user_preferences.ai_model_id` column is retained but unused.

## Architecture

```
Supabase Auth → middleware.ts (Edge, redirects to /login)
              → lib/auth/requireUser.ts (API routes get user.id)
              → src/registry.ts getServicesForUser(userId)
                 → per-user SnapTradeProvider (or NullBrokerProvider) + scoped caches
```

`src/` follows clean-architecture layering: `domain/interfaces/` (ports), `infrastructure/providers/` (adapters), `services/` (composition). `getServices()` is a legacy singleton for CLI/cron use only and carries a `NullBrokerProvider` — user-facing paths must use `getServicesForUser()`.

User-facing API routes take `requireUserWithClient()` and pass the caller's RLS-scoped client into the vault store. Service-role access (`createServiceClient()`) is reserved for system-scoped and cross-tenant work.

**Predictions/forecasting** is the key subsystem: the agent emits dated predictions, the system resolves them against the actual close at the horizon date, and calibration feeds back into the prompts. Horizons are 1, 7, and 30 days. Predictions live in the `predictions` table behind `lib/predictions/store.ts`. Production runs forecaster recipe **v4** (`version` option in `lib/agent/sweep.ts` → `lib/agent/forecast.ts`). A candidate recipe can run with `shadow: true`: its predictions are recorded and resolved but excluded from production scoring and signals. Compare with `npm run compare:forecasters` before promoting.

**Vault storage** (`lib/vault/store.ts`) is the `vault_notes` table — markdown body plus JSONB frontmatter, unique on `(user_id, path)`.

Schema lives in `supabase/migrations/`. Tables are RLS-protected on `auth.uid() = user_id` unless system-scoped; `congress_trades` and `app_secrets` are shared, and a `handle_new_user()` trigger seeds defaults on signup.

Deeper detail: `docs/headless-worker.md` (worker runbook), `docs/congress-trades-system.md`, `docs/recalibration.md`, `docs/data-handling.md`, `docs/snaptrade-brokerage-ui.md`. Some docs predate the move from vault files to the `predictions` table and the E\*TRADE removal. Trust the code when they disagree.
