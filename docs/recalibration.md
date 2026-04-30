# Recalibration System

## What it does

After the brain makes predictions (BUY/SELL/HOLD per news story), those predictions are resolved against actual price movement 7 days later. Recalibration aggregates those outcomes into a signal the brain reads on every future run — so it knows which types of predictions have historically been right or wrong.

## Data flow

```
agent run → predictions/{TICKER}-7d.json (status: pending)
         ↓  (7 days later, next agent run)
         → predictions/{TICKER}-7d.json (status: resolved, outcome: CORRECT/INCORRECT)
         ↓
npm run recalibrate --apply
         ↓
_metrics/calibration.json    ← aggregated win rates by ticker, catalyst, confidence, engine
world-brain/sector-rules.md  ← ## Calibration Provenance block stamped with drift flags
```

## Key files

| File | Role |
|------|------|
| `world-brain/calibration.ts` | Reads all resolved predictions, writes `calibration.json` |
| `scripts/recalibrate.ts` | Compares win rates against rule-implied confidence, writes provenance block to `sector-rules.md` |
| `world-vault/_metrics/calibration.json` | Source of truth — win rates by ticker, catalyst type, confidence bucket, engine |
| `world-brain/sector-rules.md` | Auto-appended `<!-- BEGIN AUTO -->` block; hand-written rules above it are untouched |

## Drift detection

Each catalyst type has a rule-implied confidence midpoint (e.g. `analyst-upgrade` → 0.82). If the actual win rate diverges by **>15pp**, the catalyst is flagged:

- `(DOWNWEIGHT)` — actual accuracy well below rule-implied → brain over-trusts this signal
- `(TRUSTED)` — actual accuracy above rule-implied → brain can lean in harder

The brain reads this block at inference time via `sector-rules.md`, which is loaded into the system prompt.

## Running it

```bash
npm run recalibrate              # dry run — prints proposed provenance block
npm run recalibrate -- --apply   # writes changes to sector-rules.md
```

## Automation

A monthly cron fires at **2am on the 1st of each month** (registered in `src/instrumentation.ts`). It:
1. Calls `updateCalibration()` to regenerate `calibration.json` from all resolved predictions
2. Spawns `recalibrate.ts --apply` to stamp fresh provenance into `sector-rules.md`

The TopBar shows a **"CALIBRATED {date}"** badge with the last run date. Hovering shows the resolved prediction count.

## Limitations

- Per-engine routing (routing to MLX vs DeepSeek based on per-catalyst accuracy) is not yet implemented — all current predictions are `backfill-v1` so there's no multi-engine signal yet.
- Catalyst classification is regex-first; complex stories may be tagged `other`.
- Win rate requires **n ≥ 3** resolved predictions per catalyst before flagging — new catalysts will show "insufficient data" until enough history accumulates.
