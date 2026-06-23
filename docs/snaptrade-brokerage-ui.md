# SnapTrade Brokerage UI Variants

A spec for rendering each connected brokerage with its own identity (logo, brand
color, status, data treatment) in the account panel's Brokerage Connection section.
Source of truth: SnapTrade's brokerage list — https://support.snaptrade.com/brokerages
(42 brokerages as of this writing) — surfaced per-connection via the SDK.

## Don't scrape — the SDK already carries everything

Every `listBrokerageAuthorizations` result includes a `brokerage` object with the
fields we need. **No scraping of the support site is required.**

| Field | Use |
|-------|-----|
| `slug` | Stable key for the variant map (e.g. `ETRADE`, `PNC`, `SCHWAB`). |
| `name` / `display_name` | Row label. |
| `aws_s3_square_logo_url` | **Row logo** (square). Falls back to `aws_s3_logo_url` (landscape). |
| `brokerage_type.name` | `Traditional Brokerage`, etc. — drives data treatment. |
| `allows_trading` | Whether trade actions are even possible. |
| `is_real_time_connection` | Real-time vs. daily-cached badge. |
| `release_stage` | `GENERALLY_AVAILABLE` \| `BETA` \| `ALPHA` \| `DEVELOPMENT` → status badge. |
| `maintenance_mode` / `is_degraded` | Show a "maintenance/degraded" warning. |

Per-connection state also comes from the authorization: `disabled` + `disabled_date`
→ `Active` vs `Reconnect needed`. **There is no token-expiry countdown under SnapTrade**
(unlike the old direct-E\*TRADE OAuth); SnapTrade maintains the connection.

## What's already implemented

- `pages/api/snaptrade/status.ts` returns `connections[]`, each with `{ id, name, slug,
  logo, disabled, accounts[], totalBalance }`, grouped by authorization (so bank-only
  connections like PNC still appear).
- `components/layout/AccountPanel/BrokerageCard.tsx` renders one row per connection:
  square logo (dot fallback), brand-colored left bar + accent, `Active`/`Reconnect needed`
  status, per-account balances, and an aggregate total.
- `colorFor(name, slug)` maps known brand slugs → identity color, hashing unknown ones
  into a palette so every row is visually distinct.

## Variant dimensions (what makes each brokerage unique)

1. **Logo** — `aws_s3_square_logo_url` (the square mark; minimal/no wordmark). White-bg
   logos are pre-keyed to transparent locally (see step 3); others are used as-is.
2. **Brand color** — left bar + status dot. From the table below; hash fallback otherwise.
3. **Data treatment** — by `brokerage_type` / `allows_trading`:
   - *Brokerage* (E\*Trade, Schwab, Fidelity, Robinhood, …): show holdings total + accounts; positions flow to the dashboard.
   - *Bank / Alpha / no-account* (PNC today): show as **connected** with a compact "No accounts reported" note. SnapTrade does not return bank checking/savings balances — that needs a bank aggregator (Plaid), tracked separately.
4. **Release-stage badge** — small pill mirroring SnapTrade's table:
   - `GENERALLY_AVAILABLE` → green "Available"
   - `BETA` → amber "Beta"
   - `ALPHA` / `DEVELOPMENT` → magenta "Alpha" (set expectations: data may be partial)
5. **Capability hints** — optional chips: `Real-time` vs `Daily`, `Trading` vs `Read-only`.

## Brand-color registry (extend `BRAND_COLORS` in `BrokerageCard.tsx`)

Keys are the normalized slug (lowercased, alphanumerics only). Colors are the
brokerages' identity colors; tune to taste. Unlisted brokerages fall back to the
hashed palette automatically.

| Brokerage | slug | normalized key | brand color |
|-----------|------|----------------|-------------|
| E\*Trade | `ETRADE` | `etrade` | `#7b4ae0` |
| Charles Schwab (Read-Only / Trading) | `SCHWAB` | `schwab` | `#00a0df` |
| Fidelity | `FIDELITY` | `fidelity` | `#3a8a3f` |
| Robinhood | `ROBINHOOD` | `robinhood` | `#ccff00` |
| Interactive Brokers | `INTERACTIVE-BROKERS-FLEX` | `interactivebrokersflex` | `#d81222` |
| Kraken | `KRAKEN` | `kraken` | `#7132f5` |
| Moomoo | `MOOMOO` | `moomoo` | `#ff6a00` |
| Public | `PUBLIC` | `public` | `#5979ff` |
| Questrade | `QUESTRADE` | `questrade` | `#3aa86b` |
| Empower | `EMPOWER` | `empower` | `#d23f3f` |
| eToro | `ETORO` | `etoro` | `#5bb85b` |
| Edward Jones | `EDWARD-JONES` | `edwardjones` | `#003087` |
| Stake (AU) | `STAKEAUS` | `stakeaus` | `#5b3df5` |
| tastytrade | `TASTYTRADE` | `tastytrade` | `#e0354b` |
| TD Direct Investing | `TD-DIRECT-INVESTING` | `tddirectinvesting` | `#3cb34a` |
| PNC | `PNC` | `pnc` | `#f58025` |

> Note: keep colors high-contrast on the dark panel; for very dark brand colors
> (e.g. navy), lighten for the accent bar so it reads against `rgba(0,0,0,0.55)`.

## Implementation checklist for adding/refining a variant

1. Confirm the `slug` from a live `listBrokerageAuthorizations` (or the support page).
2. Add `slug → color` to `BRAND_COLORS`.
3. Logos are automatic via `aws_s3_square_logo_url`. **White-background logos** (some
   are JPGs with white baked in, e.g. E\*Trade) can't be made transparent in CSS — run
   `npx tsx --env-file=.env.local scripts/prep-brokerage-logos.ts`. It fetches **every**
   brokerage via `referenceData.listAllBrokerages()`, and for each whose corners sample
   near-white it **flood-fills the background from the corners inward** → transparent and
   writes `public/brokerages/<normalized-slug>.png` (slug lowercased, alphanumerics only —
   the same key `BrokerageCard` uses). Flood-fill (not a global white key) preserves white
   marks sitting inside a colored tile, e.g. moomoo's white bull on orange. Logos already
   transparent or on a colored/dark background (e.g. PNC navy) are skipped — keying a
   colored background eats the logo's edges. No override map to maintain: `BrokerageCard`
   tries `/brokerages/<key>.png` first and falls back to the remote URL via `<img onError>`.
4. If the brokerage is `ALPHA`/`DEVELOPMENT` or returns no accounts, ensure the row's
   empty-state copy is sensible (it already shows "No accounts reported").
5. (Optional) Add the release-stage pill and capability chips described above.

## Future: release-stage + capability badges (not yet built)

Extend the status endpoint to also return `releaseStage`, `realTime`, `allowsTrading`
from `brokerage`, and render small pills in each row. Low effort — the data is already
on the authorization object.
