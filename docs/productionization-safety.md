# Productionization Safety (rate limiting, cost caps, observability)

Guards that make the app safe to expose to strangers in a free beta. Plan tasks
10 (rate limiting), 13 (LLM/sweep cost caps), and the groundwork for 12
(observability). All in-memory — **valid only because Pulse runs as a single
long-lived Node process under pm2** (`ecosystem.config.cjs`). On multi-instance
deploy, swap the stores for Supabase/Redis behind the same function signatures.

## Rate limiting — `lib/rate-limit.ts`

In-memory sliding window: `rateLimit(key, { max, windowMs })` → `{ allowed,
remaining, retryAfterMs }`. Rejected requests are **not** counted, so spamming
while over the limit can't unblock you. A periodic (unref'd) sweep drops idle
keys so memory doesn't grow unbounded.

Two layers, because the dashboard's own fan-out is high (refresh every 30s →
one `/api/news` request **per held ticker**, all at once, × browser tabs):

1. **Coarse per-IP circuit breaker** — applied to every route by `apiHandler`
   (`IP_LIMIT`, generous; opt out per route with `ipRateLimit: false`). Keyed
   `ip:<ip>:<route>` (parses one `X-Forwarded-For` hop). Anti-accident, **not**
   anti-attacker — XFF is spoofable and proxies collapse users onto one IP, so
   it's deliberately loose.
2. **Per-user limits inside expensive handlers** (the real protection) — applied
   *after* `requireUser` so the key is the user, not the IP:
   - `/api/news` → `NEWS_LIMIT` (600/min — clears a 30-ticker user across tabs).
   - `/api/predictions` → `PREDICTIONS_LIMIT` (120/min).

   Both return `429` + `Retry-After`. Limits are generous by design: they stop
   runaway loops / scripted abuse (thousands of distinct tickers), not normal use.

Tune the numbers in `lib/rate-limit.ts` (named constants). Verified by an
ad-hoc test: N allowed, N+1 → 429, rejected hits don't unblock, identities are
isolated, window refills.

## Sweep cost caps — `pages/api/agent/run.ts` + `lib/agent/sweep.ts`

A sweep calls DeepSeek per ticker per horizon, so beyond the existing
single-flight 409 guard:

- **Per-user cooldown** (`SWEEP_COOLDOWN_MS`, 5 min) on the POST trigger →
  `429` + `Retry-After` if a user re-triggers too soon.
- **Ticker cap** (`SWEEP_MAX_TICKERS`, 40) — `sweep.ts` slices the position list
  so a huge account can't fan out unboundedly.
- Structured `sweep started user=…` log line per run.

Both are **uniform** (not free/paid-tiered) — there is no web entitlements model
yet (`lib/license` is a legacy desktop trial, no-op unless `PULSE_DESKTOP=1`).
The tier-aware split is Milestone 2 (Stripe + entitlements).

## Observability — Sentry (`@sentry/nextjs`) + `lib/observability.ts`

Sentry is installed and wired across all three runtimes; it **activates only
when a DSN is configured** (every `Sentry.init` is DSN-guarded), so the repo is
safe to run/commit without one.

Files:
**DSN lives in Supabase `app_secrets`** (key `SENTRY_DSN`) — the single source of
truth, no DSN in `.env.local`. The three runtimes get it differently:

- `sentry.server.config.ts` — Node runtime. Imported from `src/instrumentation.ts`
  `register()` **after** `hydrateSecrets()`, so the `app_secrets` value is in
  `process.env.SENTRY_DSN` before init reads it. `includeLocalVariables: true`.
- `sentry.edge.config.ts` — Edge runtime (middleware). Edge can't read
  `app_secrets` (no hydration there), so edge reporting is off unless `SENTRY_DSN`
  is also in **real** env. Acceptable — middleware errors are rare.
- Browser — `NEXT_PUBLIC_*` is build-time-inlined and **cannot** come from
  `app_secrets`. So instead of relying on it, the root layout (`app/layout.tsx`,
  a server component) reads the hydrated `process.env.SENTRY_DSN` and hands it to
  `components/providers/SentryClientInit.tsx`, a client component that inits the
  browser SDK at runtime (error-only Session Replay). The DSN is public by design.
  `instrumentation-client.ts` remains an optional build-time fallback
  (`NEXT_PUBLIC_SENTRY_DSN`) and exports `onRouterTransitionStart`; the two are
  mutually guarded by `Sentry.getClient()` so they never double-init.
  Caveat: statically-prerendered pages (`/login`, `/terms`) bake an empty DSN, so
  client reporting there is off — the whole authenticated app is dynamic and
  fully covered.
- `instrumentation.ts` / `src/instrumentation.ts` — `register()` dispatches per
  `NEXT_RUNTIME`; re-exports `onRequestError` (`captureRequestError`).
- `app/global-error.tsx` — App Router root error boundary → `Sentry.captureException`.
- `next.config.ts` — wrapped with `withSentryConfig` (source-map upload via
  `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`; `tunnelRoute` omitted to
  avoid colliding with the auth middleware's `/login` redirects).

`lib/observability.ts` is still the server choke point:
- `newRequestId()` — short id set as `X-Request-Id` by `apiHandler`, attached to
  every captured error.
- `captureException(err, ctx)` — always logs structured JSON to stderr, **and**
  forwards to Sentry when `Sentry.getClient()` is initialized (safe no-op
  otherwise). Call sites never change.

### Enabling Sentry
DSN is already stored in `app_secrets` (key `SENTRY_DSN`, org `ian-wolframs-org`
/ project `javascript-nextjs`). To (re)configure:
1. Upsert the DSN: `INSERT INTO app_secrets(key,value) VALUES('SENTRY_DSN', '<dsn>')
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`
2. Restart the server so `hydrateSecrets()` re-runs.
3. (Optional, source maps) `SENTRY_AUTH_TOKEN` in `.env.sentry-build-plugin`
   (gitignored); org/project already default in `next.config.ts`.
4. Verify: visit `/sentry-example-page` (logged in) and click the button, or
   throw a test error → it appears in Sentry Issues within ~30s.
   Throwaway: `app/sentry-example-page/page.tsx` + `pages/api/sentry-example-api.ts`
   — delete after verifying.

> Build note: Turbopack emits an "unexpected file in NFT list" warning traced
> through `lib/constants.ts`' dynamic `fs`/`path` usage. It's pre-existing
> (Sentry's build tracing merely surfaces it), a warning not an error, and
> irrelevant to the single-process pm2 deploy (only affects serverless bundle
> size). `disableLogger` was removed — it's deprecated and a no-op under Turbopack.
