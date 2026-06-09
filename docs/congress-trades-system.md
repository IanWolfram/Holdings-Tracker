# Congressional Trades — How It Works

Pulse shows **congressional stock trades** next to your positions (the "Hot
Trades" feed on the position cards). This used to come from a third-party site
(pelositracker.app), which capped results at 100 rows and required a paid plan
for its best data. We now collect the data **ourselves, straight from the
official government sources** — so there's no cap, no third party, and the
accuracy is something we control.

> For the full build history and design rationale, see
> [`congress-official-scraper-plan.md`](./congress-official-scraper-plan.md).

## What it does, in one picture

```
House Clerk PTRs  ─┐
                   ├─►  parse  ─►  roster join  ─►  Supabase          ─►  read seam  ─►  Position card
Senate eFD PTRs   ─┘   (rows)     (add party)      `congress_trades`     (+excess ret.)   "Hot Trades"
```

Members of Congress must file a **Periodic Transaction Report (PTR)** within 45
days of a trade (the STOCK Act). We download those filings, pull out each
buy/sell, figure out who the member is, and store the rows in our database. The
app then reads them by ticker.

## The pieces (`lib/congress/`)

| File | Job |
|------|-----|
| `house.ts` | Download the House Clerk's yearly filing dump, parse each PTR PDF into trade rows. |
| `senate.ts` | Do the access handshake with the Senate eFD site, read each electronic PTR's HTML table. |
| `roster.ts` | Look up each filer in the public `congress-legislators` dataset to fill in **party** and **bioguide id**. |
| `db.ts` | Read/write the `congress_trades` table (service-role only) and an ingest log. |
| `ingest.ts` | Runs House + Senate together; used by both the CLI and the daily cron. |
| `index.ts` | The **read seam**: turns DB rows into the shape the UI wants, and computes **excess return** (the trade's return vs SPY since the trade date). |

The database has two tables (`supabase/migrations/20260609161848_…`):
- **`congress_trades`** — one row per parsed trade (ticker, buy/sell, amount,
  dates, member, party, …). Shared/public data, readable by any logged-in user,
  written only by the server.
- **`congress_ingest_log`** — remembers which filings we've already processed so
  daily runs only do new work, and counts the scanned/paper filings we skip.

## How the data refreshes

- **Automatically:** a daily cron (`instrumentation.node.ts`, 03:00 UTC) pulls in
  any new filings. Because filings lag trades by 30–45 days, daily is plenty.
- **Manually:**
  ```bash
  npm run congress:ingest                  # daily incremental (current year)
  npm run congress:ingest -- --backfill    # reload ~18 months, both chambers
  npm run congress:ingest -- --senate-only --limit 20   # narrow runs for testing
  ```

It's **incremental** — re-running is safe and skips filings it already has.

## A couple of details worth knowing

- **Coverage.** About 88–91% of filings are digital and parse cleanly. The rest
  are **scanned paper** PTRs (images) — we skip and *count* them rather than
  guess. Reading those would need OCR, which is a deferred future step.
- **What we skip.** Rows with no stock ticker (treasury bills, municipal bonds,
  real estate) and "exchange" transactions are intentionally dropped — the feed
  is about stock buys and sells.
- **Switching sources.** The app uses our own data by default. Setting the env
  var `CONGRESS_SOURCE=pelosi` flips back to the old pelositracker source, which
  we keep around as a fallback / sanity check.
- **Excess return** is computed locally (stock return minus SPY return since the
  trade date), since the official filings don't include it.
