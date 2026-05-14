---
type: community
cohesion: 0.25
members: 9
---

# Data Flow Documentation

**Cohesion:** 0.25 - loosely connected
**Members:** 9 nodes

## Members
- [[Apple MLX AI Engine]] - document - README.md
- [[Data Flow Architecture]] - document - CLAUDE.md
- [[DeepSeek API Integration]] - document - CLAUDE.md
- [[Dual Routing Decision]] - document - CLAUDE.md
- [[ETRADE Position Aggregation]] - document - README.md
- [[News Aggregator]] - document - README.md
- [[Per-User Cache Scoping]] - document - CLAUDE.md
- [[Pulse (Holdings Tracker)]] - document - README.md
- [[Stale-While-Revalidate Caching]] - document - README.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Data_Flow_Documentation
SORT file.name ASC
```
