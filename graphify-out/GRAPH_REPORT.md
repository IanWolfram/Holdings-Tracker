# Graph Report - .  (2026-06-09)

## Corpus Check
- 276 files · ~181,820 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 951 nodes · 1728 edges · 45 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `TrafficSystem` - 18 edges
2. `NewsService` - 13 edges
3. `FsVaultStore` - 11 edges
4. `main()` - 10 edges
5. `SupabaseVaultStore` - 10 edges
6. `updateCalibration()` - 9 edges
7. `main()` - 9 edges
8. `main()` - 8 edges
9. `getLicenseStatus()` - 8 edges
10. `getDetailedQuote()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `getLicensePath()` --calls--> `getUserDataPath()`  [EXTRACTED]
  electron/license.js → lib/license.ts
- `requirePremiumAccess()` --calls--> `getLicenseStatus()`  [EXTRACTED]
  lib/license.ts → electron/license.js
- `readState()` --calls--> `getLicensePath()`  [EXTRACTED]
  lib/license.ts → electron/license.js
- `getLicenseStatus()` --calls--> `readState()`  [EXTRACTED]
  electron/license.js → lib/license.ts
- `isValidLicenseKeyFormat()` --calls--> `checksumSeed()`  [EXTRACTED]
  lib/license.ts → electron/license.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (21): coerceAnalyzedAge(), isAnalyzedAge(), FinnhubProvider, NewsAPIProvider, buildOAuth(), getAccessToken(), getRequestToken(), toHeader() (+13 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (13): handleCancel(), handleKeyDown(), handleSubmit(), onKeyDown(), submit(), formatCountdown(), getMarketStatus(), minutesFromMidnight() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (12): classifyNews(), findInVault(), keywordClassify(), ClassifierService, extractCatalystTypes(), extractHeadline(), extractReason(), extractSummary() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (43): fallbackProfile(), fetchCompanyProfile(), normalizeKey(), resolveCoordinates(), fetchFullArticleContent(), isPublicHttpUrl(), buildTickerKnowledge(), getRecentVaultStories() (+35 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (5): CountryFocusPanel(), flagEmoji(), findCountryAtLatLon(), pointInGeoPolygon(), pointInRing()

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (48): clampConfidence(), createPredictionId(), loadLocalEnv(), magnitudeFromConfidence(), main(), parseFrontmatter(), readHeadline(), readReason() (+40 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (24): classifyTxType(), companyFromBuffer(), fetchBytes(), fetchHousePtrIndex(), fetchPtrDocument(), ingestHouse(), normalizeAmount(), parseHousePtr() (+16 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (8): buildBoatModel(), buildPlaneModel(), cellLat(), cellLon(), clamp(), MinHeap, slerpUnit(), TrafficSystem

### Community 8 - "Community 8"
Cohesion: 0.1
Nodes (7): computeCompliant(), enrichExcessReturns(), fetchCongressTrades(), isoToUnixSeconds(), readableAssetType(), returnSince(), rowToCongressTrade()

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (17): buyRatio(), classifyMomentum(), loadAllNews(), loadSupplyChainSource(), logReturns(), parseFrontmatter(), pct(), pearson() (+9 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (23): asRecord(), buildCalibrationBlock(), collectResolvedPredictions(), confidenceBucket(), createStats(), getConfidenceReliabilityFactor(), getPredictionCatalystTypes(), invalidateCalibrationCache() (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.16
Nodes (18): bar(), flag(), hr(), main(), renderStory(), tags(), checksumSeed(), ensureLicensedOrTrial() (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (6): formatCurrency(), formatGainLoss(), calculateSentimentMetrics(), clamp01(), normalizeConfidence(), verdictToPolarity()

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (14): analyzeStory(), buildCorrelatedHoldingsBlock(), buildMarketContextBlock(), callDeepSeekRawInternal(), computeHeuristicRelevance(), consumeStream(), fallbackAnalysis(), findRecentVerdictForTicker() (+6 more)

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (3): FsVaultStore, splitFrontmatter(), SupabaseVaultStore

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (4): ETradeProvider, PortfolioService, mapRawPosition(), normalizeAcquiredDate()

### Community 16 - "Community 16"
Cohesion: 0.21
Nodes (13): addDays(), dateKey(), fetchFinnhubEarnings(), getEventsSnapshot(), getFallbackMacroEvents(), getUpcomingEarnings(), uniqSortedTickers(), buildNoteContent() (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.23
Nodes (13): frontmatterHasCatalysts(), injectCatalystsIntoFrontmatter(), loadLocalEnv(), main(), parseScalarField(), readHeadline(), readReason(), rewriteFile() (+5 more)

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (2): DiskCache, MapCache

### Community 19 - "Community 19"
Cohesion: 0.22
Nodes (2): NewsService, withinWindow()

### Community 20 - "Community 20"
Cohesion: 0.28
Nodes (11): aggregateTickerBuyCountsLast30Days(), buildContradictionAlertContent(), detectClusteringAnomalies(), detectContradictions(), meanAbsCorrelationToPortfolio(), readSubagentPrompt(), resolveContradictionWithMetaAnalyst(), runAlertsPass() (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (1): HttpAccountClient

### Community 22 - "Community 22"
Cohesion: 0.26
Nodes (5): dedupeStories(), jaccard(), normalizeHeadline(), pickCanonical(), UnionFind

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (6): analysisKey(), cancelStockAgent(), getAgentProgress(), getOrInitTickerAnalysis(), getTickerAnalysisProgress(), setTickerAnalysis()

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (5): daysAgo(), fetchFinnhubNews(), fetchQuote(), requireKey(), today()

### Community 25 - "Community 25"
Cohesion: 0.44
Nodes (7): appRootPath(), createMainWindow(), ensureUserDataConfigFiles(), iconPath(), parseEnvFile(), startNextServer(), userDataPath()

### Community 26 - "Community 26"
Cohesion: 0.36
Nodes (5): dotFillPolygon(), latLonToVector3(), processDots(), srgbToLinear(), verdictColor()

### Community 27 - "Community 27"
Cohesion: 0.53
Nodes (4): main(), migrateViaPg(), migrateViaSupabase(), walkDir()

### Community 28 - "Community 28"
Cohesion: 0.6
Nodes (5): ensureModeChosen(), getModePath(), promptForMode(), readMode(), writeMode()

### Community 29 - "Community 29"
Cohesion: 0.7
Nodes (4): computeHeuristicRelevance(), parseFrontmatter(), repairVault(), resolveVaultPath()

### Community 30 - "Community 30"
Cohesion: 0.5
Nodes (2): buildRelevanceProfile(), escapeRegex()

### Community 31 - "Community 31"
Cohesion: 0.4
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 33`** (2 nodes): `instrumentation.node.ts`, `register()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `FinnhubBadge.tsx`, `FinnhubBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `TopBarDivider.tsx`, `TopBarDivider()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `flag-emoji.ts`, `flagEmoji()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `instrumentation.ts`, `register()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `electron-builder.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `PolygonBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `modePreload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `licensePreload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TrafficSystem` connect `Community 7` to `Community 4`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `NewsService` connect `Community 19` to `Community 2`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `FsVaultStore` connect `Community 14` to `Community 3`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._