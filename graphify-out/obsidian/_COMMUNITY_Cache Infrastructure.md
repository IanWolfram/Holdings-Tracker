---
type: community
cohesion: 0.07
members: 43
---

# Cache Infrastructure

**Cohesion:** 0.07 - loosely connected
**Members:** 43 nodes

## Members
- [[.accessToken()]] - code - src/infrastructure/providers/ETradeProvider.ts
- [[.buildOAuth()]] - code - src/infrastructure/providers/ETradeProvider.ts
- [[.clearCache()]] - code - src/services/PortfolioService.ts
- [[.constructor()_3]] - code - src/infrastructure/cache/DiskCache.ts
- [[.constructor()_4]] - code - src/infrastructure/providers/ETradeProvider.ts
- [[.constructor()_7]] - code - src/services/PortfolioService.ts
- [[.delete()_3]] - code - src/infrastructure/cache/DiskCache.ts
- [[.delete()_2]] - code - src/infrastructure/cache/MapCache.ts
- [[.fetchAccountIdKeys()]] - code - src/infrastructure/providers/ETradeProvider.ts
- [[.fetchLive()]] - code - src/services/PortfolioService.ts
- [[.filePath()]] - code - src/infrastructure/cache/DiskCache.ts
- [[.get()_1]] - code - src/infrastructure/cache/DiskCache.ts
- [[.get()]] - code - src/infrastructure/cache/MapCache.ts
- [[.getCashBalance()]] - code - src/infrastructure/providers/ETradeProvider.ts
- [[.getCashBalanceSafe()]] - code - src/services/PortfolioService.ts
- [[.getEntry()]] - code - src/infrastructure/cache/DiskCache.ts
- [[.getPositions()]] - code - src/infrastructure/providers/ETradeProvider.ts
- [[.getPositionsSafe()]] - code - src/services/PortfolioService.ts
- [[.getWithMeta()_1]] - code - src/infrastructure/cache/DiskCache.ts
- [[.getWithMeta()]] - code - src/infrastructure/cache/MapCache.ts
- [[.set()_1]] - code - src/infrastructure/cache/DiskCache.ts
- [[.set()]] - code - src/infrastructure/cache/MapCache.ts
- [[.toHeader()]] - code - src/infrastructure/providers/ETradeProvider.ts
- [[DiskCache]] - code - src/infrastructure/cache/DiskCache.ts
- [[DiskCache.ts]] - code - src/infrastructure/cache/DiskCache.ts
- [[ETradeProvider]] - code - src/infrastructure/providers/ETradeProvider.ts
- [[ETradeProvider.ts]] - code - src/infrastructure/providers/ETradeProvider.ts
- [[IBrokerProvider.ts]] - code - src/domain/interfaces/IBrokerProvider.ts
- [[ICache.ts]] - code - src/domain/interfaces/ICache.ts
- [[MapCache]] - code - src/infrastructure/cache/MapCache.ts
- [[MapCache.ts]] - code - src/infrastructure/cache/MapCache.ts
- [[PortfolioService]] - code - src/services/PortfolioService.ts
- [[PortfolioService.ts]] - code - src/services/PortfolioService.ts
- [[enrichWithCompanyNames()]] - code - pages/api/positions.ts
- [[enrichWithHistory()]] - code - pages/api/positions.ts
- [[handler()_9]] - code - pages/api/positions.ts
- [[mapRawPosition()]] - code - src/mappers/positionMapper.ts
- [[position.types.ts]] - code - types/position.types.ts
- [[positionMapper.ts]] - code - src/mappers/positionMapper.ts
- [[positions.ts]] - code - pages/api/positions.ts
- [[seededRand()]] - code - src/mappers/positionMapper.ts
- [[tickerSeed()]] - code - src/mappers/positionMapper.ts
- [[withSyntheticHistory()]] - code - src/mappers/positionMapper.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Cache_Infrastructure
SORT file.name ASC
```

## Connections to other communities
- 8 edges to [[_COMMUNITY_API Routes & Services]]
- 5 edges to [[_COMMUNITY_Dashboard UI & Hooks]]
- 3 edges to [[_COMMUNITY_3D Globe Renderer]]
- 2 edges to [[_COMMUNITY_Position Cards & News UI]]
- 2 edges to [[_COMMUNITY_Vault & Constants]]
- 1 edge to [[_COMMUNITY_ETRADE OAuth]]
- 1 edge to [[_COMMUNITY_Classification & Congress]]

## Top bridge nodes
- [[position.types.ts]] - degree 18, connects to 6 communities
- [[positions.ts]] - degree 9, connects to 3 communities
- [[ETradeProvider.ts]] - degree 5, connects to 1 community
- [[PortfolioService.ts]] - degree 5, connects to 1 community
- [[ICache.ts]] - degree 4, connects to 1 community