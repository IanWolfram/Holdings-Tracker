---
type: community
cohesion: 0.33
members: 15
---

# Alert Detection Engine

**Cohesion:** 0.33 - loosely connected
**Members:** 15 nodes

## Members
- [[aggregateTickerBuyCountsLast30Days()]] - code - world-brain/alerts.ts
- [[alerts.ts]] - code - world-brain/alerts.ts
- [[buildContradictionAlertContent()]] - code - world-brain/alerts.ts
- [[detectClusteringAnomalies()]] - code - world-brain/alerts.ts
- [[detectContradictions()]] - code - world-brain/alerts.ts
- [[ensureDir()_1]] - code - world-brain/alerts.ts
- [[loadJson()]] - code - world-brain/alerts.ts
- [[meanAbsCorrelationToPortfolio()]] - code - world-brain/alerts.ts
- [[readSubagentPrompt()]] - code - world-brain/alerts.ts
- [[resolveContradictionWithMetaAnalyst()]] - code - world-brain/alerts.ts
- [[runAlertsPass()]] - code - world-brain/alerts.ts
- [[updateSizingReport()]] - code - world-brain/alerts.ts
- [[writeBreadthFlipAlert()]] - code - world-brain/alerts.ts
- [[writeFileAtomic()_2]] - code - world-brain/alerts.ts
- [[writeTickerClusterAlert()]] - code - world-brain/alerts.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Alert_Detection_Engine
SORT file.name ASC
```

## Connections to other communities
- 2 edges to [[_COMMUNITY_Agent Orchestration]]
- 1 edge to [[_COMMUNITY_News Backfill Scripts]]
- 1 edge to [[_COMMUNITY_Calibration Backfill]]
- 1 edge to [[_COMMUNITY_Vault & Constants]]
- 1 edge to [[_COMMUNITY_Debug & News Fetch]]
- 1 edge to [[_COMMUNITY_Calibration & Vault Store]]

## Top bridge nodes
- [[alerts.ts]] - degree 21, connects to 6 communities