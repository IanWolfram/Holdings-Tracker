---
type: community
cohesion: 0.06
members: 48
---

# Vault & Constants

**Cohesion:** 0.06 - loosely connected
**Members:** 48 nodes

## Members
- [[buildDigestMessage()]] - code - lib/telegram.ts
- [[buildRelevanceProfile()]] - code - lib/relevance.ts
- [[company-names.ts]] - code - lib/company-names.ts
- [[constants.ts]] - code - lib/constants.ts
- [[digest.ts]] - code - pages/api/digest.ts
- [[enqueuePolygon()]] - code - lib/polygon.ts
- [[escapeRegex()]] - code - lib/relevance.ts
- [[fetchCandlesPolygon()]] - code - lib/polygon.ts
- [[fetchCrumb()]] - code - lib/yahoo-finance.ts
- [[fetchNewsAPIArticles()]] - code - lib/newsapi.ts
- [[fetchNewsForTicker()]] - code - lib/news.ts
- [[fetchOHLCPolygon()]] - code - lib/polygon.ts
- [[fetchPolygonNews()]] - code - lib/polygon.ts
- [[fetchStooqQuote()]] - code - lib/stooq.ts
- [[fetchTrendingTickers()]] - code - pages/api/hot.ts
- [[fetchWithRetry()]] - code - lib/polygon.ts
- [[fetchYahooHistory()]] - code - lib/yahoo-finance.ts
- [[getCompanyName()]] - code - lib/company-names.ts
- [[getCrumb()]] - code - lib/yahoo-finance.ts
- [[getHistory()]] - code - lib/market-data.ts
- [[getNewsForTicker()]] - code - lib/news.ts
- [[getQuote()]] - code - lib/market-data.ts
- [[getQuotes()]] - code - lib/market-data.ts
- [[handler()_14]] - code - pages/api/digest.ts
- [[handler()_4]] - code - pages/api/hot.ts
- [[handler()_2]] - code - pages/api/news.ts
- [[handler()_5]] - code - pages/api/proposed-quotes.ts
- [[hot.ts]] - code - pages/api/hot.ts
- [[isRelevantToTicker()]] - code - lib/relevance.ts
- [[isYahooCrumbRateLimitedError()]] - code - lib/yahoo-finance.ts
- [[makeCrumbRateLimitedError()]] - code - lib/yahoo-finance.ts
- [[market-data.ts]] - code - lib/market-data.ts
- [[market-data.types.ts]] - code - types/market-data.types.ts
- [[news.ts]] - code - pages/api/news.ts
- [[newsapi.ts]] - code - lib/newsapi.ts
- [[polygon.ts]] - code - lib/polygon.ts
- [[proposed-quotes.ts]] - code - pages/api/proposed-quotes.ts
- [[relevance.ts]] - code - lib/relevance.ts
- [[resolve-predictions.ts]] - code - scripts/resolve-predictions.ts
- [[resolvePredictions()]] - code - scripts/resolve-predictions.ts
- [[resolveVaultPath()_2]] - code - lib/constants.ts
- [[scoreRelevance()]] - code - lib/relevance.ts
- [[sendTelegramMessage()]] - code - lib/telegram.ts
- [[startPolygonFetch()]] - code - lib/market-data.ts
- [[stooq.ts]] - code - lib/stooq.ts
- [[telegram.ts]] - code - lib/telegram.ts
- [[withinNewsWindow()]] - code - lib/news.ts
- [[yahoo-finance.ts]] - code - lib/yahoo-finance.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Vault_&_Constants
SORT file.name ASC
```

## Connections to other communities
- 11 edges to [[_COMMUNITY_API Routes & Services]]
- 8 edges to [[_COMMUNITY_Classification & Congress]]
- 5 edges to [[_COMMUNITY_Agent Orchestration]]
- 4 edges to [[_COMMUNITY_Debug & News Fetch]]
- 4 edges to [[_COMMUNITY_Calibration & Vault Store]]
- 3 edges to [[_COMMUNITY_3D Globe Renderer]]
- 3 edges to [[_COMMUNITY_Dashboard UI & Hooks]]
- 3 edges to [[_COMMUNITY_News Backfill Scripts]]
- 3 edges to [[_COMMUNITY_Earnings Events]]
- 3 edges to [[_COMMUNITY_Price Computation]]
- 2 edges to [[_COMMUNITY_Cache Infrastructure]]
- 2 edges to [[_COMMUNITY_Calibration Backfill]]
- 2 edges to [[_COMMUNITY_Sector Graph & Analysis]]
- 2 edges to [[_COMMUNITY_Position Cards & News UI]]
- 2 edges to [[_COMMUNITY_ETRADE OAuth]]
- 1 edge to [[_COMMUNITY_Vault Metadata & Testing]]
- 1 edge to [[_COMMUNITY_Alert Detection Engine]]

## Top bridge nodes
- [[constants.ts]] - degree 40, connects to 16 communities
- [[news.ts]] - degree 21, connects to 6 communities
- [[resolve-predictions.ts]] - degree 7, connects to 4 communities
- [[market-data.ts]] - degree 15, connects to 3 communities
- [[polygon.ts]] - degree 11, connects to 3 communities