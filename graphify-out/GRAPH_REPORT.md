# Graph Report - .  (2026-05-18)

## Corpus Check
- 215 files · ~190,559 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 781 nodes · 1419 edges · 42 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `main()` - 12 edges
2. `NewsService` - 12 edges
3. `FsVaultStore` - 11 edges
4. `SupabaseVaultStore` - 10 edges
5. `updateCalibration()` - 9 edges
6. `main()` - 9 edges
7. `vaultRoot()` - 8 edges
8. `updateSectorGraph()` - 8 edges
9. `getLicenseStatus()` - 8 edges
10. `getQuote()` - 8 edges

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
Cohesion: 0.04
Nodes (10): formatCountdown(), getMarketStatus(), minutesFromMidnight(), nyParts(), newConversation(), startNewChat(), fetchState(), schedule() (+2 more)

### Community 1 - "Community 1"
Cohesion: 0.04
Nodes (15): FinnhubProvider, NewsAPIProvider, compute2026PnL(), computeRealizedPnL(), computeUnrealizedPnL(), PolygonProvider, getServices(), getServicesForUser() (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (22): classifyNews(), findInVault(), keywordClassify(), ClassifierService, dedupeStories(), jaccard(), normalizeHeadline(), pickCanonical() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (5): handleCancel(), handleKeyDown(), handleSubmit(), formatCurrency(), formatGainLoss()

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (5): CountryFocusPanel(), flagEmoji(), findCountryAtLatLon(), pointInGeoPolygon(), pointInRing()

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (9): fallbackProfile(), fetchCompanyProfile(), ETradeProvider, normalizeKey(), resolveCoordinates(), PortfolioService, enrichWithCompanyNames(), enrichWithHistory() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (12): fetchTrendingTickers(), handler(), getHistory(), startPolygonFetch(), enqueuePolygon(), fetchCandlesPolygon(), fetchOHLCPolygon(), fetchPolygonNews() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (18): bar(), flag(), hr(), main(), renderStory(), tags(), fetchFullArticleContent(), isPublicHttpUrl() (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (21): asRecord(), buildCalibrationBlock(), collectResolvedPredictions(), confidenceBucket(), createStats(), getPredictionCatalystTypes(), invalidateCalibrationCache(), loadCalibrationReport() (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (20): frontmatterHasCatalysts(), injectCatalystsIntoFrontmatter(), loadLocalEnv(), main(), parseScalarField(), readHeadline(), readReason(), rewriteFile() (+12 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (21): addDays(), dateKey(), fetchFinnhubEarnings(), getEventsSnapshot(), getFallbackMacroEvents(), getUpcomingEarnings(), uniqSortedTickers(), buildSummary() (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (20): buyRatio(), classifyMomentum(), ensureDir(), loadAllNews(), loadSupplyChainSource(), logReturns(), parseFrontmatter(), pct() (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (5): FsVaultStore, reconstructMarkdown(), serializeFrontmatter(), splitFrontmatter(), SupabaseVaultStore

### Community 13 - "Community 13"
Cohesion: 0.14
Nodes (18): analyzeStory(), buildCorrelatedHoldingsBlock(), buildMarketContextBlock(), callDeepSeekRawInternal(), computeHeuristicRelevance(), consumeStream(), fallbackAnalysis(), findRecentVerdictForTicker() (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (13): daysAgo(), fetchFinnhubNews(), fetchQuote(), requireKey(), today(), buildTickerKnowledge(), getRecentVaultStories(), getSubagentPrompt() (+5 more)

### Community 15 - "Community 15"
Cohesion: 0.2
Nodes (12): checksumSeed(), ensureLicensedOrTrial(), getLicensePath(), getLicenseStatus(), getUserDataPath(), isValidLicenseKeyFormat(), readLicenseState(), readState() (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (6): glowClass(), PositionCard(), calculateSentimentMetrics(), clamp01(), normalizeConfidence(), verdictToPolarity()

### Community 17 - "Community 17"
Cohesion: 0.32
Nodes (13): accessToken(), buildOAuth(), fetchAccountIdKey(), fetchPortfolio(), fromCache(), getAccessToken(), getCashBalance(), getPositions() (+5 more)

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (2): DiskCache, MapCache

### Community 19 - "Community 19"
Cohesion: 0.33
Nodes (14): aggregateTickerBuyCountsLast30Days(), buildContradictionAlertContent(), detectClusteringAnomalies(), detectContradictions(), ensureDir(), loadJson(), meanAbsCorrelationToPortfolio(), readSubagentPrompt() (+6 more)

### Community 20 - "Community 20"
Cohesion: 0.28
Nodes (12): appendVaultLog(), buildVerdictTrend(), dailySummary(), findRecentContradictions(), findTopRecentStories(), nowStamp(), parseFrontmatter(), readDirSafe() (+4 more)

### Community 21 - "Community 21"
Cohesion: 0.32
Nodes (14): computeAtr14(), computeRsi14(), dedupeAndSortBars(), fetchBarsFromSource(), fetchFinnhubDailyBars(), fetchPolygonDailyBars(), fetchYahooDailyBars(), getDailyBars() (+6 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (1): HttpAccountClient

### Community 23 - "Community 23"
Cohesion: 0.29
Nodes (12): clampConfidence(), createPredictionId(), findBarOnOrAfter(), findBarOnOrBefore(), loadLocalEnv(), magnitudeFromConfidence(), main(), parseFrontmatter() (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.24
Nodes (2): NewsService, withinNewsWindow()

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
Cohesion: 0.67
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
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

## Knowledge Gaps
- **Thin community `Community 31`** (2 nodes): `instrumentation.node.ts`, `register()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `instrumentation.ts`, `register()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `FinnhubBadge.tsx`, `FinnhubBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `signout.ts`, `handler()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `electron-builder.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `PolygonBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `modePreload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `licensePreload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NewsService` connect `Community 24` to `Community 2`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._