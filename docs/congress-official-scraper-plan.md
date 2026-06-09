# Plan: Official-Source Congressional Trade Scraper

Replace the pelositracker.app dependency with a scraper that ingests directly
from the **authoritative government sources** — the House Clerk financial
disclosure dump and the Senate eFD system. Goal: accuracy we control, no third
party, no 100-row cap.

## Locked decisions
- **`excessReturn`: compute ourselves** (benchmark/window TBD — likely return
  since trade date vs. SPY). Keep the disclosure-panel row.
- **Start with Phase 0 sampling spike.**
- **OCR: deferred.** MVP ingests digital/electronic PTRs only; scanned/paper
  filings are skipped **and counted** (logged), never silently dropped.

## Why this is structurally different from pelositracker

pelositracker is **ticker-indexed** — we could ask `/stock/{ticker}` live, per
request. The official sources are **filing-centric**: there is *no* ticker
index. You must ingest *all* Periodic Transaction Reports (PTRs), parse each into
rows, store them, and then query by ticker.

So the model changes from "HTTP fetch per request" to:

```
[cron] ingest job → download filings → parse → upsert into shared DB table
[request] fetchCongressTrades(tickers) → SELECT ... WHERE ticker = ANY($tickers)
```

**The seam and the `CongressTrade` type stay identical.** Everything already
built — the card, the watchlist union fix, the brown styling, `/api/congress`,
`useCongress`, the per-position rendering — survives untouched. Only the body of
`getHotTrades`/`fetchCongressTrades` changes from HTTP-fetch to DB-read.

The accuracy story also moves: it's no longer "do we trust a third party" but
"do we trust **our parser and our name→party join**." Those are the two real
risks; the plan front-loads both.

## Verified facts (probed live, June 2026)

### House — `disclosures-clerk.house.gov`
- **Index:** `https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{YEAR}FD.zip`
  → contains `{YEAR}FD.xml`: one `<Member>` per filing with
  `Last, First, FilingType, StateDst (e.g. AL04), FilingDate, DocID`.
  2025 had **515 `FilingType=P`** (PTR) entries.
- **PTR document:** `https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{YEAR}/{DocID}.pdf`
  - E-filed PTRs (DocID `200xxxxx`) are **digital text PDFs** — extract cleanly
    with `pdf-parse` v2 (`getText` / `getPageTables`). The lone embedded image is
    a signature. Verified row:
    `GSK plc American Depositary Shares (GSK) [ST]  S  07/28/2025  08/11/2025  $1,001 - $15,000`
  - Paper-filed PTRs (other DocID ranges) are **scanned images** → need OCR.
- House XML has **no party** — join required (see Roster phase).

### Senate — `efdsearch.senate.gov`
- **Handshake required:** GET `/search/home/` (grab `csrfmiddlewaretoken` + cookie)
  → POST `/search/home/` with `prohibition_agreement=1` (→ 302) → cookie now
  accepts searches.
- **Search API (JSON):** POST `/search/report/data/` with `report_types=[11]`
  (PTR) returns rows `[First, Last, "Last, First (Senator)", "<a href=/search/view/ptr/{uuid}/>…</a>", date]`.
  241 PTRs since 2025-01-01.
- **Electronic PTR view:** GET `/search/view/ptr/{uuid}/` → clean **HTML table**
  with columns: `# · Transaction Date · Owner · Ticker · Asset Name · Asset Type
  · Type · Amount · Comment`. Ticker is its own column (easier than House).
- **Paper PTR:** `/search/view/paper/{uuid}/` → scanned PDF → OCR.
- Chamber is implicitly `senate`; party via roster.

## Field mapping (official → existing `CongressTrade`)

| CongressTrade        | House source                              | Senate source            |
|----------------------|-------------------------------------------|--------------------------|
| `ticker`             | from `(TICKER)` in asset text             | `Ticker` column          |
| `companyName`        | asset text (strip ticker/type)            | `Asset Name`             |
| `assetType`          | `[ST]`/`[OP]`… code                        | `Asset Type`             |
| `tradeType`          | action `P`/`S`/`E` (+ option asset type)  | `Type` (+ asset type)    |
| `amount`             | amount range column                       | `Amount`                 |
| `tradeDate`          | Transaction Date                          | `Transaction Date`       |
| `filedDate`          | XML `FilingDate` / PDF notification date  | report date              |
| `politician`         | member name                               | "Last, First"            |
| `party` / `chamber`  | **roster join** (state+district) / house  | roster / `senate`        |
| `id`                 | `house-{DocID}-{rowIdx}`                   | `senate-{uuid}-{rowIdx}` |
| `url`                | PTR PDF URL                               | PTR view URL             |
| `isCompliant`        | **computed**: `filedDate−tradeDate ≤ 45d` | computed                 |
| `excessReturn`       | **not available** — drop or compute (see below) | same               |

**`excessReturn` does not exist in official filings** (it was pelositracker's
computed metric). Decision required: (A) remove the "Excess return" row from the
disclosure panel, or (B) compute it ourselves (trade-date price vs current, minus
benchmark) using the existing market-data layer. Recommend **(A) drop for MVP**,
revisit (B) later.

## Phase 0 findings (spike completed)

Sampled 756 House PTRs (2025–26) + 100 recent Senate PTRs.

**House**
- **~88% digital, ~12% non-digital.** Digital = DocID `200xxxxx` (e-filed text
  PDFs). The "other" ~12% is a *mix* of paper scans **and dead 404 links** — so
  classify **at fetch by content**, not by DocID: `/Font` present → parse;
  image-only → scanned (skip+count); HTML body → 404 (skip).
- **`getTable` does NOT work** — PTR tables are text-positioned, not border-ruled,
  so the geometry detector returns zero tables. **Locked strategy: `getText()` +
  a line parser** anchored on the transaction line
  (`^(P|S|E)( \(partial\))?\s+MM/DD/YYYY\s+MM/DD/YYYY\s+\$amount`), with ticker
  pulled from the preceding `(TICKER) [TYPE]`.
- Verified on a 15-page / ~40-transaction PTR (Cisneros `20033762`): all rows
  extract. Edge cases seen and handled: asset name wrapping 2 lines, amount
  wrapping (`$15,001 -` / `$50,000`), action inline with ticker, `(partial)`
  suffix, foreign tickers (`AJINF`, `D: Ticker 2802 JP`).

**Senate**
- **~91% electronic, ~9% paper.** Electronic PTR view is a clean HTML table;
  parse rows directly (regex/cheerio). Columns: `# · Transaction Date · Owner ·
  Ticker · Asset Name · Asset Type · Type · Amount · Comment`. Ticker is its own
  column (e.g. `PTON · Peloton… · Stock · Sale (Full) · $1,001 - $15,000`).
  Paper → skip+count.

**MVP coverage (digital/electronic only):** ~88% House, ~91% Senate of all PTRs.
Skipped remainder is scanned paper → deferred OCR phase. Parser strategy is now
locked for both chambers.

## Phases

### Phase 0 — Sampling spike — ✅ DONE (findings above)
Do not design the parser off the two PDFs already inspected. Pull **~25 recent
House PTRs + ~25 Senate PTRs** and learn the variety:
- Count **digital vs scanned** (House DocID `200xxxxx` heuristic; Senate
  electronic vs paper). This fraction decides if OCR is MVP or deferred.
- Run `pdf-parse` `getPageTables` on **multi-transaction** House PTRs (5–50 rows).
  `getText` interleaves columns on multi-row tables — confirm ticker/action/
  date/amount land in the right cells. **This is the single biggest correctness
  risk.**
- Confirm Senate electronic table parses with `cheerio` across several reports.
- Output: a short findings note + locked parser strategy. MVP = digital/
  electronic only, **skip-and-count** scanned.

### Phase 1 — Schema + migration — ✅ DONE
Migration `supabase/migrations/20260609161848_create_congress_trades.sql`,
applied to remote. Created `congress_trades` (RLS: authenticated SELECT only;
service-role writes via RLS bypass) + `congress_ingest_log` (service-role only,
no policies). Added `check` constraints on `source`/`party`/`chamber`/`tx_type`
and the ticker+date and unique `(source, doc_id, row_index)` indexes.

Shared, public, portfolio-agnostic table (matches the multi-tenant rule):
```sql
create table congress_trades (
  id            text primary key,          -- house-{docid}-{row} / senate-{uuid}-{row}
  source        text not null,             -- 'house' | 'senate'
  doc_id        text not null,             -- DocID / uuid
  row_index     int  not null,
  politician    text not null,
  bioguide_id   text,
  party         text,                      -- D | R | I
  chamber       text not null,             -- house | senate
  ticker        text not null,
  company_name  text,
  asset_type    text,
  tx_type       text not null,             -- buy | sell | buy_option | sell_option
  amount_range  text,
  traded_date   date,
  filed_date    date,
  comment       text,
  url           text,
  content_hash  text,                      -- dedupe / change detection
  ingested_at   timestamptz default now()
);
create index on congress_trades (ticker, traded_date desc);
create unique index on congress_trades (source, doc_id, row_index);
-- RLS: authenticated SELECT; service-role INSERT/UPDATE only.
```
Also a small `congress_ingest_log` (source, doc_id, processed_at, status) so the
daily run is incremental and skips already-processed filings.

### Phase 2 — House ingester (`lib/congress/house.ts`) — ✅ DONE
Built `lib/congress/{types,db,house}.ts`. Deps added: `pdf-parse@2`, `fflate`,
`fast-xml-parser`. `ingestHouse({supabase, years, limit, force})` does the full
loop; pure `parseHousePtr()` / `fetchHousePtrIndex()` / `fetchPtrDocument()` are
exported for testing.

**Parser strategy (as built):** `getText()` + a line parser (pdf-parse's
`getPageTables` is private in v2 and `getTable` returns nothing for these
text-positioned tables, confirming Phase 0). Strip ` ` letterspacing,
buffer asset lines, anchor on the transaction line
(`(P|S|E)…  MM/DD/YYYY MM/DD/YYYY $amount`, action may be **inline** after the
asset), take the **last** `(TICKER) [TYPE]` in the buffer, stitch wrapped
amounts (`$15,001 -` + `$50,000`) and 2-line asset names. `[OP]` → option;
`E` (exchange) skip+count; no-ticker rows (bonds/treasuries/real-estate)
skip+count.

**Key correctness decision:** upsert on `(source, doc_id, row_index)` (the
positional `id`), **never `content_hash`** — byte-identical trades are legit
distinct disclosures. `content_hash` is change-detection only.

**Measured (60-PTR sample, 2025):** 98.3% filings parsed (1 scanned, 0 errors);
82% of detected transaction lines emitted (the other 18% are correctly-skipped
no-ticker bonds/treasuries). Stress doc `20024346` (Bresnahan, 16pp, 130 tx):
129 emitted, duplicate trades preserved (BABA×4, AAON×2), option row correct
(`BRK.B sell_option [OP]`). End-to-end DB insert + incremental skip verified
against the live table.

Steps implemented:
1. Download `{YEAR}FD.zip`, unzip in memory (`fflate`), parse XML
   (`fast-xml-parser`), filter `FilingType=P`.
2. Diff against `congress_ingest_log`; for each **new** DocID fetch PDF and
   **classify by content** (`%PDF-` header + non-empty text), not by DocID.
3. Extract ticker from `(…)`, asset type code, action `P/S/E`→`tx_type`, dates,
   amount. Skip rows with no ticker.
4. Upsert into `congress_trades`; log every processed DocID with status +
   row_count. Skip + count scanned/404.

> Party/bioguide are intentionally left `null` here — filled by the Phase 4
> roster join.

### Phase 3 — Senate ingester (`lib/congress/senate.ts`) — ✅ DONE
Built `lib/congress/senate.ts`. Dep added: `cheerio`. `SenateSession`
(cookie-jar + CSRF handshake) exposes `init()` / `searchPtrs(since)` /
`fetchPtrView(uuid)`; pure `parseSenatePtr()`; `ingestSenate({supabase, since,
limit, force})` orchestrator.

**Handshake (as built):** GET `/search/home/` (scrape `csrfmiddlewaretoken` +
absorb `csrftoken` cookie via `Headers.getSetCookie()`) → POST `/search/home/`
with `prohibition_agreement=1` (assert 302) → POST `/search/report/data/` with
`report_types=[11]`, `X-CSRFToken` header = csrftoken cookie, paginated 100/page.

**Parser:** electronic PTR view is one clean `<table>`; columns `# · Tx Date ·
Owner · Ticker · Asset Name · Asset Type · Type · Amount · Comment`. Ticker is
its own column (skip `--` = bonds/munis). The `#` column is the stable per-report
`row_index` (keeps duplicate trades distinct). `Purchase`→buy, `Sale (Full|
Partial)`→sell, asset-type/`Type` containing "option"→`*_option`, anything else
(e.g. Exchange) skip+count. `filed_date` = the search row's submitted date.

**Measured/verified (live):** 241 PTRs since 2025-01-01 (matches Phase 0).
8-filing run → 7 parsed, 1 paper (correctly skipped+logged), 0 errors; rows
clean (NVDA/ORCL/PTON/DTE/IVW), duplicate NVDA trades preserved with distinct
`row_index`, traded/filed dates both populated. End-to-end DB insert verified.

Steps implemented:
1. Handshake (CSRF + `prohibition_agreement`), in-memory cookie jar.
2. POST `/search/report/data/` with `report_types=[11]`, paginate.
3. For each **new** PTR uuid: paper → log `scanned`+skip; electronic → GET view →
   `cheerio` parse → rows.
4. Map + upsert; log every uuid with status + row_count.

> Party/bioguide left `null` — filled by the Phase 4 roster join.

### Phase 4 — Roster join (`lib/congress/roster.ts`) — ✅ DONE
Built `lib/congress/roster.ts` and **wired it into both ingesters**. `loadRoster()`
fetches `legislators-current.json` + `legislators-historical.json` (536 + 12,230)
and builds a `Roster` index. `resolveHouse(stateDst, last)` / `resolveSenate(first,
last)` → `{ bioguideId, party }`.

**Join keys (as built):** House on **state+district** parsed from `StateDst`
("AL04" → repSeat `AL4`), disambiguated by last name, with fallbacks (same-state
rep name match → any-rep name match). Senate by last name among senators,
disambiguated by first name. Party normalized to `D`/`R`/`I` from the member's
latest term; surnames normalized (NFD-strip diacritics, drop Jr/Sr/III).

**Integration:** one member files one PTR, so the orchestrator resolves **once
per filing** and stamps `party`/`bioguide_id` on all that filing's rows before
upsert. Roster load failure is non-fatal (logs, leaves both null). The roster is
loaded fresh per ingest run (refresh-on-run, per plan).

**Verified:** Aderholt AL04→R/A000055, Allen GA12→R, Pelosi CA11→D, Cantwell→D,
McCormick→R, Moreno→R; wired end-to-end run stamped party/bioguide on House +
Senate rows correctly.

> Pre-Phase-4 test rows keep `party=null`; Phase 7's full backfill (or a `force`
> re-ingest) repopulates them.

### Phase 5 — Wire the seam to the DB — ✅ DONE
Built `lib/congress/index.ts` `fetchCongressTrades(tickers)` →
`SELECT * WHERE ticker IN (…) ORDER BY traded_date DESC LIMIT 250`, mapping
`CongressTradeRow` → the UI `CongressTrade`: ISO→unix-seconds dates, House asset
codes → words (`ST`→"Stock", `OP`→"Option"), `isCompliant` derived from the
45-day STOCK Act window, `party` null → "I". Never throws (DB error → []).

**`excessReturn`: computed ourselves** (user decision; matches the locked
decision over the Phase-5-prose "drop" suggestion). `enrichExcessReturns()` =
(stock return since trade date) − (SPY return over the same window), via the
existing `getDailyBars` + `findBarOnOrAfter`; bounded concurrency, bars cached,
800-day window, best-effort (missing/too-old bars → "N/A"), non-fatal. Verified
live: GSK +19.2%, AZO −28.5%, ORCL +7.8%, etc.

**No card changes needed** — the seam emits the same `CongressTrade` shape the
CongressTradeCard already renders (`excessReturn` + `isCompliant` rows now
populated).

**Cutover switch** (`lib/insiders.ts`): `CONGRESS_SOURCE=db` uses the new
pipeline, default/`pelosi` keeps pelositracker. Default stays pelositracker until
the Phase 7 backfill so the half-populated table can't hijack the UI; flip the
env once backfilled. `lib/pelositracker.ts` kept as fallback/oracle.

> Browser verification deferred to Phase 7 — there's no representative data to
> see until the backfill lands.

### Phase 6 — Scheduling + incremental — ✅ DONE
Built `lib/congress/ingest.ts` `runCongressIngest()` (shared orchestrator,
service-role client, **per-chamber try/catch** so one source being down can't
block the other) + `scripts/ingest-congress.ts` CLI + `npm run congress:ingest`
(`npx tsx --env-file=.env.local …`, calls `hydrateSecrets()` itself).

**CLI flags:** `--backfill` (House [2025,currentYear] + Senate since 01/01/2025),
`--house-only` / `--senate-only`, `--limit N`, `--years 2025,2026`, `--since
MM/DD/YYYY`, `--force`. Exit 1 on row errors or a whole-chamber failure.

**Cron:** added a daily `0 3 * * *` job to `instrumentation.node.ts` (clear of
the 22:00 resolve + 02:00 recalibrate) calling `runCongressIngest()` inline —
incremental, so a light no-op on quiet days.

**Verified:** CLI runs end-to-end (hydrates 14 secrets, roster join active,
incremental skip of already-logged docs across years, `--senate-only` works,
clean exit). The 30–45 day STOCK Act lag makes daily cadence ample.

### Phase 7 — Backfill, cross-validate, cutover — ✅ DONE
**Backfill** (`npm run congress:ingest -- --backfill`, 188s, 0 errors):
- House 2025+2026: 686 parsed / 63 scanned / 0 errors → **8,680 rows** (1,169
  no-ticker + 37 exchange skipped). 91.6% of filings parsed.
- Senate since 2025-01-01: 203 parsed / 25 paper / 0 errors → **849 rows**.
  89% electronic. Total table ≈ **9,569 rows**.

**Cross-validation vs pelositracker** (AAPL/NVDA/TM/MSFT/TSLA): our DB is a
**strict superset** of pelositracker's recent data. Low-volume **TM** matches
exactly (DB 6 vs pelosi 4, identical recent trades). High-volume gaps are
entirely pelositracker's **100-row all-time cap** (DB 112/147/157 vs 58/83/63 for
AAPL/NVDA/MSFT) — **not** parser bugs. Recent trades, parties, dates, and option
classification all align where they overlap. Negative control → 0/0.

**Cutover:** flipped `getHotTrades` default to the DB source (`lib/insiders.ts`);
`CONGRESS_SOURCE=pelosi` kept as the fallback / reconciliation oracle.
`lib/pelositracker.ts` retained, not deleted. Verified the exact `/api/congress`
seam now returns DB-backed trades with party + excess return + compliance.

---

## Status: COMPLETE ✅ (Phases 0–7)
The pelositracker dependency is replaced end-to-end by an official-source
pipeline we control: House Clerk + Senate eFD → parse → roster join → Supabase
`congress_trades` → read seam → existing CongressTradeCard. Daily incremental
cron keeps it fresh; no 100-row cap; accuracy is our parser (validated) + a
state+district roster join. OCR for scanned/paper PTRs (~9–11%) remains the one
deferred follow-up.

## Risks & mitigations
- **Multi-row PDF parsing (House)** — highest risk. Mitigate with `getPageTables`
  (cell-aware) + Phase 0 spike + cross-validation.
- **Scanned/paper filings** — skip + count for MVP; OCR (Tesseract) is a later
  phase if the skipped fraction is material.
- **Name→party join** — key on state+district/bioguide, not name.
- **Senate handshake fragility / rate limits** — polite delays, cookie reuse,
  retries; ingest is daily not per-request.
- **Ingestion latency** — data appears only after a run, not per-request; dwarfed
  by the 30–45d legal filing lag.
- **Legal/ToS** — public-domain government data; be polite (UA, rate-limit,
  cache). No paywall, no auth.

## New dependencies
`pdf-parse` (already validated), `fflate` (unzip), `fast-xml-parser` (House XML),
`cheerio` (Senate HTML).

## Effort
Multi-day build (vs. the pelositracker swap which was hours). Phase 0 spike
first; ship House+Senate digital/electronic MVP; defer OCR. Keep pelositracker
live throughout until cutover.
