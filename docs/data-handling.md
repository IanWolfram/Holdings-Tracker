# Data Handling & Privacy Posture

> Status: **draft** — supports the Privacy Policy (`app/(legal)/privacy/page.tsx`) and the launch
> plan's Layer 0. Review with legal counsel before charging users. Not legal advice.

This document records what user data Pulse stores, where it lives, how it is isolated, and how it
is (or should be) deleted. It is the technical backing for the public Privacy Policy.

## What we store

| Category | Where | Notes |
| --- | --- | --- |
| Account identity | Supabase Auth | Email + auth credentials, managed by Supabase. |
| Brokerage OAuth tokens | `etrade_tokens` | **Encrypted at rest** via AES-256-GCM (`lib/crypto/tokenCipher.ts`); `key_version` supports rotation. |
| SnapTrade registration | `snaptrade_users` | Per-user SnapTrade `userId` + `userSecret`; the secret is **sealed** (AES-256-GCM via `sealSecret`). Connects brokerages through the SnapTrade aggregator. |
| Short-lived OAuth secrets | `etrade_request_tokens` | 10-minute TTL request-token secrets. |
| Preferences | `user_preferences` | AI model, default timescale, vault/cron opt-in. |
| Generated content | `vault_notes` | Predictions, calibration, session insights, world-brain notes (markdown + JSONB frontmatter). |
| Activity timestamps | `user_activity` | Last-seen / last-refresh. |
| Positions / balances | Retrieved live; cached in per-user scoped caches (`u:<userId>:`) | Pulled on demand from the broker/aggregator; not persisted long-term as a table of holdings. |

**Shared / non-personal:** `app_secrets` (operator config), `congress_trades` + `congress_ingest_log`
(public filing data, no `user_id`). These contain no user PII.

## Isolation

- **Row-Level Security** on all per-user tables: `auth.uid() = user_id`. The DB enforces tenant
  isolation independent of application code.
- **Service-layer scoping**: `getServicesForUser(userId)` (`src/registry.ts`) builds per-user
  providers and **key-prefixed** caches (`u:<userId>:`) so one tenant's cache can't serve another's.
- **No process-wide caching of per-user content** (e.g. session insights in `world-brain/brain.ts`),
  to avoid cross-tenant leakage.
- Brokerage tokens are encrypted **at the application layer** before they reach the database.

## Third-party processors

- **Supabase** — auth + Postgres storage.
- **Brokerage connectivity** — E\*TRADE (direct, pending Vendor Use) and/or SnapTrade (aggregator).
- **Market data / news** — Polygon, Finnhub, NewsAPI, Stooq.
- **AI classification** — DeepSeek (`https://api.deepseek.com/v1`); OpenAI is an alternate base URL.

Each processor receives only the data needed for its function. No user personal/financial data is
sold.

## Retention & deletion

**Current state:** data is retained while the account is active. A self-service "delete my account +
data" path is **implemented** at `POST /api/account/delete` (`pages/api/account/delete.ts`), surfaced
as a "Delete account" control in the account panel (`components/layout/AccountPanel/`).

**Deletion purges (per `user_id`), via the service-role client:**

- `agent_jobs`, `app_roles`, `conversations` (cascades to `messages`), `etrade_request_tokens`,
  `etrade_tokens`, `notifications`, `proposed_positions`, `snaptrade_users`, `stock_watches`,
  `user_activity`, `user_preferences`, `vault_notes`
- SnapTrade-side erasure: the delete route first calls `deleteSnapTradeUser` (best-effort) to remove
  the user + brokerage connections on SnapTrade before purging the local `snaptrade_users` row
- In-process per-user caches/providers via `invalidateUserServices(userId)`
- The Supabase Auth user record (`auth.admin.deleteUser`), deleted **last** so a mid-purge failure
  leaves the account intact and retryable

The route requires the caller to confirm by passing their own email (`confirmEmail`) to guard against
accidental or CSRF-driven calls.

Brokerage **disconnect** independently revokes ongoing access (`POST /api/etrade/disconnect` →
`deleteUserTokens`) without deleting the whole account.

> **Maintenance note:** when a new per-user table is added, add it to `USER_SCOPED_TABLES` in
> `pages/api/account/delete.ts`, or its rows will be orphaned on deletion.

## Open items (Layer 0)

- [x] Build the self-service account-deletion path (`POST /api/account/delete`).
- [ ] Confirm broker/aggregator terms permit the storage/processing described here.
- [ ] Legal review of this posture, the Privacy Policy, Terms, and Disclaimer.
