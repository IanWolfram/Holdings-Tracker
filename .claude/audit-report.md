# Codebase Audit Report — Holdings-Tracker (Pulse)

**Date:** 2026-05-07
**Scope:** Full codebase scan — unused code, type safety, security, formatting, anti-patterns
**Method:** 4 parallel specialized review agents (refactor-cleaner, typescript-reviewer, security-reviewer, code-reviewer)
**Constraint:** No functionality changes — findings only

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 4 | Security vulnerabilities requiring immediate action |
| HIGH | 31 | Type safety bugs, logic errors, significant duplication, security gaps |
| MEDIUM | 18 | Formatting drift, naming inconsistencies, architectural concerns |
| LOW | 9 | Minor style issues, acceptable trade-offs |

**Top 5 action items:**
1. Unauthenticated command execution endpoint (`pages/api/etrade/trigger-terminal-auth.ts`)
2. Path traversal vulnerability in `FsVaultStore` (`lib/vault/store.ts:125`)
3. SSRF via user-controlled URL in `/api/analyze-story`
4. `stripThink()` logic bug discarding JSON payloads (`world-brain/brain.ts:98`)
5. 7 dead component files + 34 unused exports cluttering the codebase

---

## CRITICAL Findings

### C1. Unauthenticated Command Execution
**File:** `pages/api/etrade/trigger-terminal-auth.ts:11`
**Type:** Security — Command Injection / Missing Auth

The endpoint calls `exec("npm run eta")` without any `requireUser()` call. Any unauthenticated request can execute npm scripts on the server. While the command string is hardcoded (not user-controlled), `exec` spawns a shell, and any future parameterization creates an injection vector.

**Fix:** Add `requireUser()`, replace `exec` with `execFile`.

### C2. OAuth Callback Auth Bypass in Single-User Branch
**File:** `pages/api/etrade/callback.ts:7-9`
**Type:** Security — Auth Bypass

The single-user legacy branch (lines 14-33) executes **before** the `requireUser()` auth check at line 38. If `PULSE_SINGLE_USER_MODE` is misconfigured or spoofed, the legacy branch runs without authentication. `oauth_token` and `oauth_verifier` are cast `as string` without validation.

**Fix:** Add independent mode validation, validate query params as alphanumeric-only.

### C3. Plaintext OAuth Request Tokens in Database
**File:** `lib/etrade/tokens.ts:128-151`
**Type:** Security — Plaintext Secrets in DB

`saveRequestToken` stores OAuth request tokens and secrets in plaintext in `etrade_request_tokens`. While 10-min TTL mitigates risk, a Supabase service-role key leak or RLS misconfiguration exposes these tokens.

**Fix:** Encrypt with same AES-256-GCM scheme used for access tokens, or ensure RLS restricts reads to `auth.uid() = user_id`.

### C4. Path Traversal in FsVaultStore
**File:** `lib/vault/store.ts:125-128`
**Type:** Security — Path Traversal

`FsVaultStore.full()` joins user-controlled paths with `nodePath.join(this.root, p)` without validating the resolved path starts with `this.root`. Any API route passing user input as a vault path (e.g., `ticker` from query params) could allow reading/writing files outside the vault root via `../../` sequences.

**Fix:** After joining, verify `resolved.startsWith(this.root + nodePath.sep)`.

---

## HIGH Findings

### Security

| ID | File | Issue |
|----|------|-------|
| H1 | `pages/api/etrade/auth.ts:15-17` | Open redirect — callback URL built from unvalidated `x-forwarded-proto` and `host` headers |
| H2 | `pages/api/analyze-story.ts:37-39`, `lib/jina.ts:7-8` | SSRF — user-controlled URL passed to Jina fetch service without domain validation |
| H3 | `pages/api/etrade/auth.ts:32`, `pages/api/etrade/callback.ts:32,67` | Error messages leak internal details (stack traces, OAuth errors) to clients |
| H4 | All `pages/api/*` routes | No rate limiting on any of 23 API routes |
| H5 | `next.config.ts`, `proxy.ts` | Missing security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) |

### Type Safety & Logic Bugs

| ID | File | Issue |
|----|------|-------|
| H6 | `world-brain/brain.ts:98-105` | **Logic bug** — `stripThink()` discards JSON payload. `stripped.slice(closeIdx + 1)` returns everything AFTER the closing brace. Should be `stripped.slice(0, closeIdx + 1)` |
| H7 | `lib/etrade.ts:193-201` | Unsafe type assertion — `fromCache<T>()` returns `entry.data as T` without runtime validation |
| H8 | `lib/auth/requireUser.ts:17` | Double type assertion `as unknown as User` bypasses type system for dev user stub |
| H9 | `lib/agent/service.ts:154,212,326,338` | Non-null assertions on `getTickerAnalysisProgress()` which can return `undefined` when TTL expires |
| H10 | `lib/agent/service.ts:508` | `Record<string, any>` for agent profiles — should be `Record<string, CompanyProfile \| null>` |
| H11 | `src/infrastructure/providers/ETradeProvider.ts:65` | `any` type in E*Trade API response mapping |

### Error Handling

| ID | File | Issue |
|----|------|-------|
| H12 | `lib/agent/service.ts` (lines 187,195,199,529,535,553,585,628) | 8 empty catch blocks silently swallow errors with no logging |
| H13 | `lib/news.ts:25`, `src/services/NewsService.ts:23` | `loadMockVerdicts()` silently returns `null` on JSON parse failure |
| H14 | `pages/api/balance.ts:30-31` | Returns `{ cashBalance: 0 }` with status 200 on error — masks failures from client |
| H15 | `lib/classifier.ts:60-67` | Semaphore `mlxQueue` silently drops errors — `then(() => fn(), () => fn())` replaces error with new call |

### Architectural & Concurrency

| ID | File | Issue |
|----|------|-------|
| H16 | `lib/agent/service.ts:80-81` | Mutable global state (`currentProgress`, `isCancelled`) won't persist across serverless instances |
| H17 | `lib/vault/store.ts` (FsVaultStore) | Synchronous `fs.readFileSync`/`writeFileSync` calls in API request path block event loop |
| H18 | `lib/etrade.ts:395-413` | `updateEtradeTokens` uses synchronous `fs` operations |
| H19 | `src/registry.ts:67` | Unbounded `_userServices` Map — no eviction, memory leak in multi-tenant deployment |
| H20 | `lib/etrade.ts:191-205`, `lib/news.ts:40` | In-memory caches with no TTL eviction or size limit |

### Duplicated Logic

| ID | Files | Issue |
|----|-------|-------|
| H21 | `lib/news.ts` vs `src/services/NewsService.ts` | Duplicate SWR-cached news fetching with classification and mock fallbacks |
| H22 | `lib/market-data.ts` vs `lib/marketdata/prices.ts` | Duplicate Yahoo Finance integration with separate crumb caches and headers |
| H23 | `lib/newsapi.ts` vs `src/infrastructure/providers/NewsAPIProvider.ts` | Duplicate NewsAPI provider (function vs class) |
| H24 | `lib/etrade.ts:360-385` vs `src/services/PortfolioService.ts:38-65` | Duplicate `getPositionsSafe()` with mock fallback |
| H25 | `world-brain/brain.ts` lines 272-311 vs 317-379 | Duplicate exponential backoff retry logic for MLX vs DeepSeek |
| H26 | `lib/world-data.ts:180,308` | Verdict threshold `0.15` logic duplicated within same file |
| H27 | `lib/agent/service.ts:221,668` | Same 30-line article content assembly block duplicated in same file |

---

## MEDIUM Findings

### Formatting & Style

| ID | Issue |
|----|-------|
| M1 | **No Prettier or ESLint configuration** — project has `npm run lint` but no `.eslintrc` or `eslint.config.mjs` rules. Formatting is ad-hoc. |
| M2 | **Inconsistent numeric separators** — `10_000` in `lib/ai-health.ts` vs `2000` in `lib/mlx.ts` vs `15000` in `lib/jina.ts` |
| M3 | **21+ non-essential `console.log` calls** — 8 in `lib/agent/service.ts` (ANSI-colored debug), 6 in `world-brain/learn.ts`, 5 in `world-brain/graph.ts`. Should use structured logger or `debug()` utility. |

### Naming & Constants

| ID | Issue |
|----|-------|
| M4 | **Finnhub base URL** — `BASE` in `lib/finnhub.ts` vs `BASE_URL` in `lib/company-names.ts`, plus 5 more files inline it |
| M5 | **Two separate `YAHOO_HEADERS`** — `lib/yahoo-finance.ts` (has `Accept-Language`) vs `lib/marketdata/prices.ts` (has `Accept: application/json`) |
| M6 | **Parqet logo URL** hardcoded in 4 files |
| M7 | **User-Agent string** duplicated in 3 files |
| M8 | **Magic numbers** — verdict threshold `0.15` in 2 files, fallback confidence `0.5` in 4+ files, content slice `6000` in 2 places, HTTP timeout `10000`/`10_000`/`15000` inconsistent across 15+ files |
| M9 | **`lib/market-data.ts` vs `lib/marketdata/`** — hyphen vs no-hyphen directory naming, overlapping responsibility |

### React & Next.js

| ID | File | Issue |
|----|------|-------|
| M10 | `app/agent/page.tsx:313` | Array index as React key — use `msg.id` for stable identity |
| M11 | `app/agent/page.tsx:104` | Unstable `useCallback` dependency — `messages` creates new array ref every render |
| M12 | `app/world/page.tsx:150-193` | `fakeStories` array injects fabricated data in production — guard behind dev/mock flag |
| M13 | `app/layout.tsx:13-22` | External Google Font `<link>` tags cause render-blocking — use `next/font/google` |
| M14 | `components/world/WorldOverlays.tsx` | Inline `style={{}}` objects create new refs every render — hoist or `useMemo` |

### Security (Medium)

| ID | File | Issue |
|----|------|-------|
| M15 | `pages/api/etrade/auth.ts:22` | Cookie missing `Secure` flag in single-user OAuth flow |
| M16 | `electron/license.js:8-20` | Weak license checksum algorithm — trivially reverse-engineered |
| M17 | `lib/supabase/server.ts:35-48` | Service-role key used broadly without audit trail |
| M18 | `package.json` | 3 known dependency CVEs (basic-ftp DoS, postcss XSS) |

---

## LOW Findings

| ID | Issue |
|----|-------|
| L1 | No CSRF tokens on state-changing endpoints (mitigated by SameSite cookies) |
| L2 | Finnhub API key in URL query params (API design limitation) |
| L3 | Synchronous `fs` operations in `lib/license.ts:29` |
| L4 | `.env.local` token file written without restrictive permissions (`0o600`) |
| L5 | Unescaped regex in `updateEnvLocal` (`lib/etrade.ts:401`) |
| L6 | Dev user bypass risk if `PULSE_SINGLE_USER_MODE` misconfigured in production |
| L7 | No TODO/FIXME comments found (neutral — either well-maintained or tracked elsewhere) |
| L8 | `pages/api/etrade/callback.ts:25` — query params typed `string | string[]` but used as `string` |
| L9 | Deep nesting (6+ levels) in `components/cards/NewsCard.tsx:176-250` |

---

## Dead Code — Safe to Remove

### Unused Files (HIGH confidence, no callers)

| File | Reason |
|------|--------|
| `hooks/useDeepAnalysis.ts` | Never imported |
| `components/icons/QuantIcon.tsx` | Never imported |
| `components/news/ReasoningTooltip.tsx` | Never imported |
| `components/world/StockLogoCube.tsx` | Never imported |
| `components/world/StockFocusPanel.tsx` | Never imported |
| `components/ui/CompanyLogo.tsx` | Only imported by dead `StockFocusPanel.tsx` |
| `lib/auth/requireAdmin.ts` | Never imported |
| `scratch.tsx` | Scratch file, not referenced |
| `scratch/` (5 files) | All scratch scripts, never imported |
| `proxy.ts` | Dead middleware draft — never wired into Next.js |
| `pages/api/quotes.ts` | API route never called from frontend |

### Unused NPM Dependencies

| Package | Confidence | Notes |
|---------|------------|-------|
| `finnhub` | HIGH | Listed but never imported; app uses direct REST calls |
| `axios` | HIGH | Never imported anywhere |
| `@eslint/eslintrc` | HIGH | Unused with flat config format |
| `autoprefixer` | MEDIUM | Likely leftover from Tailwind v3 |

### Unused Exports (HIGH confidence)

| File | Export | Used Internally Only? |
|------|--------|----------------------|
| `lib/etrade.ts` | `getTransactions` | No — never called |
| `lib/etrade/tokens.ts` | `deleteUserTokens` | No — never called |
| `lib/pnl.ts` | `MOCK_TRANSACTIONS`, `computeRealizedPnL`, `compute2026PnL` | No — never imported |
| `lib/relevance.ts` | `scoreRelevance` | No — never imported |
| `lib/news.ts` | `getNewsForTicker` | No — callers use NewsService |
| `lib/finnhub.ts` | `fetchQuote`, `fetchCandles` | No — only in dead scratch files |
| `lib/insiders.ts` | `clearInsidersCache` | No — never called |
| `lib/supabase/server.ts` | `createClient` | No — only `createServiceClient` used |
| `lib/constants.ts` | `NEWS_PREVIEW_COUNT`, `GLASS_SPRING_CONFIG` | No — never imported |
| `lib/country-coords.ts` | `COUNTRY_COORDS` | No — only `lookupCountry` used |
| `lib/crypto/tokenCipher.ts` | `encrypt`, `decrypt`, `EncryptedBlob` | Internal only — `encryptForStorage`/`decryptFromStorage` are the public API |
| `lib/utils/newsCardAnimations.ts` | `GROW_DURATION` | No — never imported |
| `lib/world-data.ts` | `invalidateWorldCache` | No — never called externally |
| `lib/vault-index.ts` | `invalidateVaultIndex` | No — never called externally |
| `lib/license.ts` | `isValidLicenseKeyFormat`, `getLicenseStatus` | Internal only |
| `world-brain/brain.ts` | `invalidateCorrelationCache` | No — never imported externally |
| `world-brain/graph.ts` | `updateCatalystPages`, `updateSectorGraph`, `updateCorrelationGraph`, `updateSupplyChainGraph` | Internal only — `runGraphPass` is the public API |
| `world-brain/learn.ts` | `buildTickerKnowledge`, `updateTickerKnowledgeFile`, `runMetaReflection` | Internal only — `runLearningPass` is the public API |
| `world-brain/predictions.ts` | `getPendingPrediction` | No — never imported externally |

---

## Large Files (candidates for splitting)

| File | Lines | Recommendation |
|------|-------|----------------|
| `lib/agent/service.ts` | 899 | Split: `runStockAgent` (417 lines), `runTickerAnalysis` (220 lines), `runForecast` (117 lines) |
| `world-brain/brain.ts` | 640 | Extract `callMlxRaw`/`callDeepSeekRaw` into provider modules |
| `components/world/globe/useGlobeScene.ts` | 533 | Extract scene setup, animation loop, marker management into hooks |
| `lib/mock-news.ts` | 523 | Data file — could move to JSON |
| `world-brain/graph.ts` | 519 | Extract `updateCatalystPages`, `updateSectorGraph`, `updateCorrelationGraph` |
| `components/layout/AccountPanel.tsx` | 491 | Split sub-panels |
| `lib/etrade.ts` | 414 | Extract OAuth flow, position fetching, transactions |
| `world-brain/alerts.ts` | 408 | Extract alert types |
| `world-brain/vault-meta.ts` | 399 | Extract `regenerateVaultIndex` |
| `lib/marketdata/prices.ts` | 392 | Extract Yahoo Finance provider, Finnhub candle provider |

---

## Positive Observations

- Electron security well-configured (`contextIsolation: true`, `nodeIntegration: false`)
- No `dangerouslySetInnerHTML` usage found
- No hardcoded secrets in source files (all from `process.env`)
- `.env.local` is in `.gitignore`
- AES-256-GCM encryption for stored E*TRADE tokens is properly implemented with IV rotation
- Electron IPC uses minimal, well-scoped APIs via `contextBridge`
- No TODO/FIXME/HACK comments — codebase appears actively maintained

---

*Report generated by 4 parallel review agents. No files were modified.*