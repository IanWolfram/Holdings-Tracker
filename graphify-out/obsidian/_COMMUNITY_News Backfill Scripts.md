---
type: community
cohesion: 0.10
members: 33
---

# News Backfill Scripts

**Cohesion:** 0.10 - loosely connected
**Members:** 33 nodes

## Members
- [[Field()]] - code - components/positions/PredictionStrip.tsx
- [[PredictionStrip.tsx]] - code - components/positions/PredictionStrip.tsx
- [[appendPrediction()]] - code - world-brain/predictions.ts
- [[backfill-news-catalysts.ts]] - code - scripts/backfill-news-catalysts.ts
- [[buildText()]] - code - world-brain/catalyst-classifier.ts
- [[catalyst-classifier.ts]] - code - world-brain/catalyst-classifier.ts
- [[classifyCatalystTypes()]] - code - world-brain/catalyst-classifier.ts
- [[classifyCatalystTypesWithModelFallback()]] - code - world-brain/catalyst-classifier.ts
- [[computePredictionOutcome()]] - code - world-brain/predictions.ts
- [[daysLeft()]] - code - components/positions/PredictionStrip.tsx
- [[derivePredictionCatalystTypes()]] - code - world-brain/predictions.ts
- [[formatDate()]] - code - components/positions/PredictionStrip.tsx
- [[frontmatterHasCatalysts()]] - code - scripts/backfill-news-catalysts.ts
- [[getAllPredictions()]] - code - world-brain/predictions.ts
- [[getPendingPrediction()]] - code - world-brain/predictions.ts
- [[getRecentResolvedPredictions()]] - code - world-brain/predictions.ts
- [[handleToggle()]] - code - components/positions/PredictionStrip.tsx
- [[handler()_12]] - code - pages/api/predictions.ts
- [[injectCatalystsIntoFrontmatter()]] - code - scripts/backfill-news-catalysts.ts
- [[loadLocalEnv()]] - code - scripts/backfill-news-catalysts.ts
- [[loadPredictions()]] - code - world-brain/predictions.ts
- [[main()]] - code - scripts/backfill-news-catalysts.ts
- [[normalizeCatalystType()]] - code - world-brain/catalyst-classifier.ts
- [[parseScalarField()]] - code - scripts/backfill-news-catalysts.ts
- [[predictionPath()]] - code - world-brain/predictions.ts
- [[predictions.ts]] - code - pages/api/predictions.ts
- [[readHeadline()_1]] - code - scripts/backfill-news-catalysts.ts
- [[readReason()]] - code - scripts/backfill-news-catalysts.ts
- [[resolveEligiblePredictions()]] - code - world-brain/predictions.ts
- [[rewriteFile()]] - code - scripts/backfill-news-catalysts.ts
- [[savePredictions()]] - code - world-brain/predictions.ts
- [[sortedUnique()]] - code - world-brain/catalyst-classifier.ts
- [[splitFrontmatter()]] - code - scripts/backfill-news-catalysts.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/News_Backfill_Scripts
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_Calibration Backfill]]
- 3 edges to [[_COMMUNITY_Position Cards & News UI]]
- 3 edges to [[_COMMUNITY_Vault & Constants]]
- 3 edges to [[_COMMUNITY_Agent Orchestration]]
- 2 edges to [[_COMMUNITY_Debug & News Fetch]]
- 2 edges to [[_COMMUNITY_Dashboard UI & Hooks]]
- 1 edge to [[_COMMUNITY_Classification & Congress]]
- 1 edge to [[_COMMUNITY_3D Globe Renderer]]
- 1 edge to [[_COMMUNITY_Sector Graph & Analysis]]
- 1 edge to [[_COMMUNITY_Calibration & Vault Store]]
- 1 edge to [[_COMMUNITY_Alert Detection Engine]]
- 1 edge to [[_COMMUNITY_Recalibration Engine]]
- 1 edge to [[_COMMUNITY_API Routes & Services]]

## Top bridge nodes
- [[predictions.ts]] - degree 34, connects to 13 communities
- [[catalyst-classifier.ts]] - degree 10, connects to 2 communities
- [[backfill-news-catalysts.ts]] - degree 12, connects to 1 community
- [[PredictionStrip.tsx]] - degree 6, connects to 1 community