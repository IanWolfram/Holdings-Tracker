# Mind Graph & Prediction Engine — Comprehensive Roadmap

## Context

The Holdings-Tracker pipeline today is a **strong qualitative pipeline with weak quantitative feedback**. It ingests ~300+ news items per cycle, runs them through a unified MLX brain (verdict + confidence + sector + geo + relevance), writes per-story notes and daily summaries to the Obsidian vault, generates 7-day directional forecasts, and asks ARCHIVIST + META-ANALYST agents to synthesize learned patterns.

The gap: **the system makes predictions but barely learns from them, and the AI sees only headlines** — never price, macro regime, calibration history, or how the rest of the portfolio is moving. The vault is a folder of richly-tagged notes but not yet a real graph (no correlation edges, no supply-chain links, no catalyst-type aggregation).

This plan turns the vault into a learning knowledge graph and feeds the brain a far richer market picture, in 5 phases.

---

## Guiding Principles

1. **Markdown-first, JSON sidecars.** Anything humans should browse stays in `.md`. Anything code aggregates lives next to it as `.json`. No SQLite (yet).
2. **Every new signal is also a graph node.** Macro regimes, catalyst types, sectors, supply-chain edges all become first-class vault entities so the Obsidian graph view actually reflects the world.
3. **Calibration is the central feedback signal.** Every layer above Phase 1 reads from `_metrics/calibration.json`.
4. **Free / cheap data only.** FRED, Yahoo/yfinance, Finnhub earnings calendar (already paid), E*TRADE quotes.

---

## Phase 0 — Data Foundation (price + macro + events)

**Goal:** Make raw market state accessible to every downstream layer.

New libraries:
- `lib/marketdata/prices.ts` — wraps E*TRADE quote endpoint for **current** quotes + **yfinance for historical OHLC bars** (free, unauthenticated). Two surfaces: `getQuote(ticker)` returns `{ price, change1d, change5d, change30d, return52wHigh, rsi14, atr14 }`; `getDailyBars(ticker, days)` returns array of `{ date, open, high, low, close, volume }`. Quote cache 1 min, bars cache 1 hr. The historical surface is what Phase 1 backfill and Phase 2c correlations depend on — call it out explicitly.
- `lib/marketdata/macro.ts` — pulls FRED series (VIX `VIXCLS`, 10Y `DGS10`, DXY `DTWEXBGS`, Fed funds `DFF`, CPI `CPIAUCSL`). Cache 1 hr.
- `lib/marketdata/events.ts` — earnings dates per ticker (Finnhub already supports this), Fed FOMC/CPI/jobs calendar (FRED + hardcoded 2026 schedule fallback).

**New env vars** (add to `.env.local`):
- `FRED_API_KEY` — free at https://fred.stlouisfed.org/docs/api/api_key.html

New vault writes:
- `world-vault/_macro/{YYYY-MM-DD}.md` — daily macro snapshot. Frontmatter: `vix`, `tenY`, `dxy`, `regime` (risk-on / risk-off / neutral, classified by simple rules: VIX>20 + DXY rising = risk-off). Body: 1-paragraph META-ANALYST commentary on the day's macro mood.
- `world-vault/_events/{YYYY-MM-DD}.md` — that day's earnings + Fed events for portfolio tickers. Auto-linked to ticker pages.

**Files modified:**
- `lib/agent/service.ts` (add macro + price fetch at start of run)
- `world-brain/brain.ts` (extend system prompt to receive macro context block)
- `world-brain/obsidian.ts` (add `writeMacroSnapshot`, `writeEventsSnapshot`)

---

## Phase 1 — Calibration & Backtesting (the learning loop)

**Goal:** The biggest gap. Turn prediction outcomes into a queryable, AI-readable accuracy record.

> **Cold-start strategy (critical):** Today only 1 prediction is resolved. Without backfill, `calibration.json` is empty for weeks and Phase 3's calibration prompt block is useless. **Phase 1 ships with a retrospective backfill**: `scripts/backfill-calibration.ts` walks the 303 indexed news items in `world-vault/news/`, treats each as a synthetic 7-day prediction (using the stored verdict + confidence + datetime), pulls historical price bars via `getDailyBars()` (Phase 0), resolves each against actual price movement, and tags catalyst type. This converts dormant data into ~300 calibration data points on day one. Run once with `npm run backfill -- --dry-run` to inspect, then `--apply`.

New artifact: `world-vault/_metrics/calibration.json`

```json
{
  "updatedAt": "2026-04-26T22:00:00Z",
  "byTicker": { "PLTR": { "n": 12, "correct": 8, "winRate": 0.667, "avgConfidence": 0.74 } },
  "byCatalyst": { "govt-contract": { "n": 5, "winRate": 0.80 }, "analyst-upgrade": { "n": 7, "winRate": 0.43 } },
  "byConfidenceBucket": {
    "0.5-0.6": { "n": 8, "winRate": 0.50 },
    "0.6-0.7": { "n": 14, "winRate": 0.57 },
    "0.7-0.8": { "n": 20, "winRate": 0.70 },
    "0.8-0.9": { "n": 11, "winRate": 0.82 }
  },
  "byHorizon": { "7d": { ... } }
}
```

Companion human-readable: `world-vault/_metrics/MONTHLY-{YYYY-MM}.md` — calibration narrative, top winning/losing catalyst types, confidence drift.

**New code:**
- `world-brain/calibration.ts` — `updateCalibration()` runs after every `resolveEligiblePredictions()` in `service.ts:221`. Reads all resolved JSONs in `world-vault/predictions/`, regenerates `calibration.json`. Tag each resolved prediction with its `catalystType` (extracted from its catalyst array — see Phase 2).
- `world-brain/backtest.ts` — CLI: `npm run backtest` produces an HTML/markdown report. Charts as ASCII or simple SVG.

**Catalyst tagging.** Today the system has free-text reasons. Add a small classifier (regex-first, model fallback) to map `reason` → catalyst enum: `govt-contract | analyst-upgrade | analyst-downgrade | earnings-beat | earnings-miss | regulatory | M&A | macro | technical | leadership | product-launch | partnership | other`. Stored alongside each verdict in news frontmatter.

> **Classifier reliability.** Garbage-in to the catalyst tag corrupts calibration at the source. Before backfill, manually label a holdout set of ~50 random news items in `world-brain/eval/catalyst-holdout.jsonl`, then run the classifier and report precision/recall per catalyst. Block the backfill if accuracy <85%. Also: **multi-catalyst stories** (e.g. "earnings beat + analyst upgrade") get an array `catalystTypes: [...]` rather than a single tag; calibration counts the story toward all of them.

**Loop closure.** Every prediction stored from Phase 1 onward includes the catalyst tag. `brain.ts` system prompt gets a new `## Your Calibration` block (auto-injected, refreshed daily):

```
You have made 47 predictions. Win rate 64%. Calibration:
  - 0.8+ confidence → 82% actual (well-calibrated)
  - 0.6-0.7 confidence → 57% (slightly overconfident)
  - govt-contract catalyst → 80% accurate
  - analyst-upgrade catalyst → 43% accurate (DOWNWEIGHT)
For PLTR specifically: 8/12 correct, but you missed 3 govt-contract calls in a row when VIX>22.
```

This single change is the single biggest accuracy lever in the whole roadmap.

---

## Phase 2 — Richer Graph Structure

**Goal:** Make the vault an actual graph. Today the only edges are news → ticker. Add 4 new edge types.

### 2a. Catalyst-type nodes
- `world-vault/catalysts/govt-contract.md`, `analyst-upgrade.md`, `earnings-beat.md` … (~12 files)
- Frontmatter: `type: catalyst`, `winRate`, `n`, `avgMagnitude`
- Body: list of recent news items with that catalyst (Dataview-friendly), narrative on what drives accuracy
- Each news note links `[[catalysts/govt-contract]]` — Obsidian graph view now clusters by catalyst.

### 2b. Sector breadth & momentum
- `world-vault/_graph/sectors.json` — `{ "Cybersecurity": { "tickers": ["CHKP"], "todayBuyPct": 1.0, "rolling7dBuyPct": 0.71, "momentum": "strong" } }`
- `world-vault/sectors/{Sector}.md` — human-readable per sector with breadth chart (rolling 30 days as ASCII spark or table).
- News frontmatter already has sector tags → just aggregate.

### 2c. Cross-ticker correlation graph
- `world-vault/_graph/correlations.json` — rolling 30-day Pearson correlation between all holdings (price returns). Recomputed nightly.
- `world-vault/_graph/correlations.md` — heatmap rendered as a markdown table. Edge entries also written into each ticker page footer ("Most correlated: HOOD 0.62, MDB 0.41").

### 2d. Supply chain map
- `world-brain/supply-chain.md` — hand-curated YAML-front-matter file describing supply-chain edges: `PLTR ← Palantir Foundry ← AWS/Azure compute ← NVDA ← TSMC`. Loaded into the system prompt so the AI can reason "TSMC fab outage → likely PLTR margin pressure."
- Render-time: a script generates `world-vault/_graph/supply-chain.md` for the Obsidian view with bidirectional links.

**Files modified:**
- `world-brain/learn.ts` (extend `runLearningPass` to update sectors.json, correlations.json, catalyst pages)
- `world-brain/obsidian.ts` (new writers for catalyst, sector, correlation pages)
- News-writing path already tags sector → just add `[[catalysts/{type}]]` to the body.

---

## Phase 3 — Enriched AI Context

**Goal:** Stop blinding the model. The brain currently sees a headline + 3 recent verdicts. Give it the full state.

Extend `brain.ts:256-263` user message to include:

```
## Market State
VIX: 18.4 (calm). 10Y: 4.2%. Regime: risk-on. Fed FOMC in 12 days.

## Focal Ticker State (PLTR)
Price: $143.09 (+2.1% 1d, +8.4% 5d, -3.2% from 52w high). RSI14: 68 (approaching overbought).
Earnings: 14 days. Sector breadth (Tech): 71% BUY signals, momentum strong.

## Your Calibration
[block from Phase 1]

## Correlated Holdings
HOOD (corr 0.62) — last verdict BUY 0.78 yesterday
MDB (corr 0.41) — last verdict HOLD 0.55 yesterday

## Recent verdicts on PLTR
[existing block]

## Story
[existing block]
```

> **Context window pressure.** Phase 3 adds ~6 new context blocks AND triples FORECASTER calls per ticker. The local DeepSeek-R1-Distill-Qwen has finite context (typically 8k–32k depending on the served variant). After Phase 3 lands, log the user-message token count per call; if it exceeds 70% of the model's context budget, truncate in this priority order: drop oldest "Recent verdicts" beyond 3 → drop low-correlation "Correlated holdings" entries → trim "Your Calibration" block to ticker-specific lines only.

**Multi-horizon predictions.** FORECASTER gets called 3 times per ticker with horizon-specific weighting:
- 1d: technical signals dominate (RSI, gap risk, earnings proximity)
- 7d: news + sector breadth (current behavior)
- 30d: macro regime + sector momentum + fundamentals

Stored as separate JSONs: `predictions/{ticker}-1d.json`, `-7d.json`, `-30d.json`. Calibration tracked per horizon.

**Files modified:**
- `world-brain/brain.ts` (assemble new context blocks)
- `world-brain/agents/FORECASTER.md` (horizon-specific instructions)
- `lib/agent/service.ts` (call forecaster 3x with different horizons)

---

## Phase 4 — Meta-signals & Anomalies

**Goal:** Auto-detect interesting situations the human should look at.

- **News decay.** Add `decayScore` to news frontmatter: `1.0 * exp(-age_days / 7)`. The brain weights recent news more; old "stale catalyst" news is filtered out of context.
- **Contradiction detector.** When 2+ news items on the same ticker same day produce opposite verdicts, write `world-vault/_alerts/{date}-contradiction-{ticker}.md` with both stories side by side. META-ANALYST is asked to resolve.
- **Signal clustering anomaly.** If sector breadth flips >50% in a day, or if a single ticker gets 5+ BUY signals in 24h (vs 30-day average of 1), flag.
- **Pre-earnings boost.** Within 7 days of earnings, the magnitude of forecast confidence is widened — these days are higher-variance.
- **Position-sizing suggestions.** New `world-vault/_metrics/sizing.json`: for each ticker, `suggestedAllocation = base × directionConfidence × historicalAccuracy × (1 - portfolioCorrelation)`. Surface in dashboard sidebar (read-only suggestion, not auto-trade).

**Files modified:**
- New `world-brain/alerts.ts` — runs after each agent pass.
- `lib/agent/service.ts` (call alerts.ts post-analysis)

---

## Phase 5 — Continuous Self-Tuning

**Goal:** Close the calibration → rules loop. Today `sector-rules.md` is hand-edited. Make it self-updating.

- **Monthly recalibration job.** `npm run recalibrate` reads `calibration.json`, identifies catalyst types where actual accuracy diverges from rule-implied confidence by >15%, and proposes edits to `sector-rules.md` as a diff. Human approves with `npm run recalibrate -- --apply`.
- **Multi-engine A/B.** The `engine` field on predictions already supports MLX vs DeepSeek API. Track per-engine accuracy; auto-route to the better engine per catalyst type.
- **Rule provenance.** Each rule in `sector-rules.md` gets a comment with the calibration data backing it: `# 0.85-0.92 BUY for govt-contract — n=12, winRate=0.83 (last updated 2026-04-30)`.

**Files modified:**
- New `scripts/recalibrate.ts`
- `world-brain/brain.ts` (engine routing decision)

---

## Storage Layout (after all phases)

```
world-vault/
├── daily/                    # existing — daily summaries
├── news/                     # existing — per-story notes (now with catalystType, decayScore)
├── predictions/              # existing — split into {ticker}-{1d,7d,30d}.json
├── _macro/                   # NEW — daily macro snapshots
├── _events/                  # NEW — earnings + Fed calendar per day
├── _metrics/                 # NEW — calibration.json + MONTHLY-*.md + sizing.json
├── _graph/                   # NEW — correlations.json, sectors.json, supply-chain.md
├── _alerts/                  # NEW — contradictions, anomalies
├── catalysts/                # NEW — 12 catalyst-type pages
├── sectors/                  # NEW — per-sector pages with breadth charts
├── {TICKER}.md              # existing — gets footer with correlations + calibration
└── ...

world-brain/
├── agents/                   # existing — AGENT, ARCHIVIST, FORECASTER, META-ANALYST
├── sector-rules.md           # existing — now with calibration provenance comments
├── supply-chain.md           # NEW — hand-curated edge map
└── market-insights.md        # existing — META-ANALYST appends
```

---

## Critical Files To Modify

| Phase | File | Change |
|-------|------|--------|
| 0 | `lib/marketdata/prices.ts` | NEW — price fetcher |
| 0 | `lib/marketdata/macro.ts` | NEW — FRED wrapper |
| 0 | `lib/marketdata/events.ts` | NEW — earnings/Fed calendar |
| 0,3 | `world-brain/brain.ts` | Extend system + user message context |
| 0 | `world-brain/obsidian.ts:54-170` | Add macro/events writers |
| 1 | `world-brain/calibration.ts` | NEW — aggregate prediction outcomes |
| 1 | `world-brain/catalyst-classifier.ts` | NEW — regex+model classifier with holdout eval |
| 1 | `world-brain/eval/catalyst-holdout.jsonl` | NEW — 50 hand-labeled news items for accuracy gate |
| 1 | `scripts/backfill-calibration.ts` | NEW — retrospective resolve over 303 indexed news items |
| 1 | `world-brain/predictions.ts:63-96` | Tag catalyst type on resolution |
| 1 | `lib/agent/service.ts:221` | Call updateCalibration after resolveEligiblePredictions |
| 2 | `world-brain/learn.ts:239` | Update sectors/correlations/catalysts in learning pass |
| 3 | `world-brain/agents/FORECASTER.md` | Multi-horizon instructions |
| 3 | `lib/agent/service.ts:73-167` | Call forecaster 3x per ticker |
| 4 | `world-brain/alerts.ts` | NEW — contradiction + clustering detector |
| 5 | `scripts/recalibrate.ts` | NEW — propose rule edits from calibration |

Reuse:
- `world-brain/obsidian.ts:writeStoryNote` pattern for all new vault writers
- `world-brain/predictions.ts:resolveEligiblePredictions` already does the price comparison work
- `lib/news.ts` 5-min cache pattern for `marketdata/*` modules
- Existing `engine` field on predictions for Phase 5 A/B routing

---

## Verification

**Phase 0:**
- Run `npm run agent` — confirm `world-vault/_macro/{today}.md` and `_events/{today}.md` are written.
- Inspect new system-prompt block in MLX server log; confirm VIX/yields appear in the user message.

**Phase 1:**
- Run `npm run eval:catalyst-classifier` against `catalyst-holdout.jsonl`; confirm precision/recall ≥0.85 per catalyst before proceeding.
- Run `npm run backfill -- --dry-run` over the 303 vault news items; spot-check 10 resolutions against actual price history.
- Run `npm run backfill -- --apply`; confirm `_metrics/calibration.json` shows ~300 data points across catalysts/buckets/tickers.
- Run `npm run backtest` — confirm monthly markdown report renders.
- Inspect a fresh agent run's prompt; confirm `## Your Calibration` block is injected with non-empty bucket data.

**Phase 2:**
- Open Obsidian graph view — confirm catalyst nodes cluster, supply-chain edges appear.
- Inspect `_graph/correlations.json` and confirm a holding pair's correlation matches a manual calc on the last 30d of prices.

**Phase 3:**
- Compare two agent runs (before/after Phase 3) on the same news fixture; confirm forecast confidence differs and reasoning references macro/calibration.
- Confirm 3 predictions per ticker exist after a run.

**Phase 4:**
- Inject 2 contradictory news items for one ticker into a test run; confirm `_alerts/{date}-contradiction-{ticker}.md` is written.

**Phase 5:**
- Run `npm run recalibrate`; confirm a diff is produced against `sector-rules.md` for at least one catalyst type with bad calibration.

---

## Suggested Sequencing

Ship in this order — each phase compounds:
1. **Phase 0 + 1 together** (~2 weekends). Foundation + calibration. This unlocks every other phase.
2. **Phase 3** (~1 weekend). Immediate accuracy lift from richer prompts.
3. **Phase 2** (~1 weekend). Graph payoff once you have data flowing.
4. **Phase 4** (~half weekend). Polish.
5. **Phase 5** (~1 weekend). Self-tuning, last because it needs Phase 1 calibration history.
