# Graph Report - .  (2026-06-23)

## Corpus Check
- 304 files · ~223,396 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1030 nodes · 1852 edges · 49 communities detected
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
Cohesion: 0.02
Nodes (16): handleCancel(), handleKeyDown(), handleSubmit(), normalize(), resolveBrokerageBrand(), onKeyDown(), submit(), formatCountdown() (+8 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (54): fallbackProfile(), fetchCompanyProfile(), addDays(), dateKey(), fetchFinnhubEarnings(), getEventsSnapshot(), getFallbackMacroEvents(), getUpcomingEarnings() (+46 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (19): coerceAnalyzedAge(), isAnalyzedAge(), HttpAccountClient, hasWhiteBackground(), keyLogo(), main(), normalizeKey(), computeNextRun() (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (13): CountryFocusPanel(), flagEmoji(), findCountryAtLatLon(), pointInGeoPolygon(), pointInRing(), buildBoatModel(), buildPlaneModel(), cellLat() (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (17): FinnhubProvider, MapCache, NewsAPIProvider, NullBrokerProvider, PolygonProvider, PortfolioService, mapRawPosition(), normalizeAcquiredDate() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (2): formatCurrency(), formatGainLoss()

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (40): baselineFlat(), computeMetrics(), dateKey(), directionalReport(), fmt(), fmtDir(), main(), versionOf() (+32 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (24): classifyTxType(), companyFromBuffer(), fetchBytes(), fetchHousePtrIndex(), fetchPtrDocument(), ingestHouse(), normalizeAmount(), parseHousePtr() (+16 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (21): classifyNews(), findInVault(), keywordClassify(), ClassifierService, dispatch(), runCongressJob(), runDueJobs(), runSweepJob() (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (20): bar(), flag(), hr(), main(), renderStory(), tags(), analyzeStory(), buildCorrelatedHoldingsBlock() (+12 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (28): asRecord(), buildCalibrationBlock(), collectResolvedPredictions(), confidenceBucket(), createStats(), getConfidenceReliabilityFactor(), getPredictionCatalystTypes(), invalidateCalibrationCache() (+20 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (5): computeCompliant(), isoToUnixSeconds(), normalizeCompanyName(), readableAssetType(), rowToCongressTrade()

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (23): clampConfidence(), createPredictionId(), loadLocalEnv(), magnitudeFromConfidence(), main(), parseFrontmatter(), readHeadline(), readReason() (+15 more)

### Community 13 - "Community 13"
Cohesion: 0.1
Nodes (6): dailyGlowClass(), PositionCard(), calculateSentimentMetrics(), clamp01(), normalizeConfidence(), verdictToPolarity()

### Community 14 - "Community 14"
Cohesion: 0.14
Nodes (17): buyRatio(), classifyMomentum(), loadAllNews(), loadSupplyChainSource(), logReturns(), parseFrontmatter(), pct(), pearson() (+9 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (3): FsVaultStore, splitFrontmatter(), SupabaseVaultStore

### Community 16 - "Community 16"
Cohesion: 0.3
Nodes (12): checksumSeed(), ensureLicensedOrTrial(), getLicensePath(), getLicenseStatus(), getUserDataPath(), isValidLicenseKeyFormat(), readLicenseState(), readState() (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (2): NewsService, withinWindow()

### Community 18 - "Community 18"
Cohesion: 0.28
Nodes (11): aggregateTickerBuyCountsLast30Days(), buildContradictionAlertContent(), detectClusteringAnomalies(), detectContradictions(), meanAbsCorrelationToPortfolio(), readSubagentPrompt(), resolveContradictionWithMetaAnalyst(), runAlertsPass() (+3 more)

### Community 19 - "Community 19"
Cohesion: 0.26
Nodes (5): dedupeStories(), jaccard(), normalizeHeadline(), pickCanonical(), UnionFind

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (6): analysisKey(), cancelStockAgent(), getAgentProgress(), getOrInitTickerAnalysis(), getTickerAnalysisProgress(), setTickerAnalysis()

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (5): daysAgo(), fetchFinnhubNews(), fetchQuote(), requireKey(), today()

### Community 22 - "Community 22"
Cohesion: 0.44
Nodes (7): appRootPath(), createMainWindow(), ensureUserDataConfigFiles(), iconPath(), parseEnvFile(), startNextServer(), userDataPath()

### Community 23 - "Community 23"
Cohesion: 0.36
Nodes (5): dotFillPolygon(), latLonToVector3(), processDots(), srgbToLinear(), verdictColor()

### Community 24 - "Community 24"
Cohesion: 0.46
Nodes (1): DiskCache

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 0.33
Nodes (2): normalizeKey(), resolveCoordinates()

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
Cohesion: 0.5
Nodes (1): SentryExampleAPIError

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

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
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
- **Thin community `Community 38`** (1 nodes): `sentry.server.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `electron-builder.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `sentry.edge.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `instrumentation-client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `global-error.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `PolygonBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `modePreload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `licensePreload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NewsService` connect `Community 17` to `Community 4`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `FsVaultStore` connect `Community 15` to `Community 1`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._