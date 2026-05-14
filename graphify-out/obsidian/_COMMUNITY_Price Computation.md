---
type: community
cohesion: 0.32
members: 15
---

# Price Computation

**Cohesion:** 0.32 - loosely connected
**Members:** 15 nodes

## Members
- [[computeAtr14()]] - code - lib/marketdata/prices.ts
- [[computeRsi14()]] - code - lib/marketdata/prices.ts
- [[dedupeAndSortBars()]] - code - lib/marketdata/prices.ts
- [[fetchBarsFromSource()]] - code - lib/marketdata/prices.ts
- [[fetchFinnhubDailyBars()]] - code - lib/marketdata/prices.ts
- [[fetchPolygonDailyBars()]] - code - lib/marketdata/prices.ts
- [[fetchYahooDailyBars()]] - code - lib/marketdata/prices.ts
- [[getDailyBars()]] - code - lib/marketdata/prices.ts
- [[getQuote()_1]] - code - lib/marketdata/prices.ts
- [[normalizeTicker()]] - code - lib/marketdata/prices.ts
- [[pctChange()]] - code - lib/marketdata/prices.ts
- [[prices.ts]] - code - lib/marketdata/prices.ts
- [[round()_1]] - code - lib/marketdata/prices.ts
- [[sliceRecent()]] - code - lib/marketdata/prices.ts
- [[yahooRangeForDays()]] - code - lib/marketdata/prices.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Price_Computation
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_Vault & Constants]]
- 1 edge to [[_COMMUNITY_Sector Graph & Analysis]]
- 1 edge to [[_COMMUNITY_Calibration Backfill]]
- 1 edge to [[_COMMUNITY_Agent Orchestration]]

## Top bridge nodes
- [[prices.ts]] - degree 20, connects to 4 communities