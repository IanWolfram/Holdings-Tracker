# Graph Report - .  (2026-06-09)

## Corpus Check
- 277 files · ~183,268 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 967 nodes · 1755 edges · 49 communities detected
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
Nodes (6): onKeyDown(), submit(), fetchState(), schedule(), startPolling(), stopPolling()

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (22): coerceAnalyzedAge(), isAnalyzedAge(), FinnhubProvider, MapCache, NewsAPIProvider, buildOAuth(), getAccessToken(), getRequestToken() (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (13): CountryFocusPanel(), flagEmoji(), findCountryAtLatLon(), pointInGeoPolygon(), pointInRing(), buildBoatModel(), buildPlaneModel(), cellLat() (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (41): analyzeStory(), buildCorrelatedHoldingsBlock(), buildMarketContextBlock(), callDeepSeekRawInternal(), computeHeuristicRelevance(), consumeStream(), fallbackAnalysis(), findRecentVerdictForTicker() (+33 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (24): classifyTxType(), companyFromBuffer(), fetchBytes(), fetchHousePtrIndex(), fetchPtrDocument(), ingestHouse(), normalizeAmount(), parseHousePtr() (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (13): FsVaultStore, reconstructMarkdown(), serializeFrontmatter(), splitFrontmatter(), SupabaseVaultStore, appendVaultLog(), dailySummary(), findRecentContradictions() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (14): classifyNews(), findInVault(), keywordClassify(), ClassifierService, NewsService, withinWindow(), extractCatalystTypes(), extractHeadline() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (26): baselineFlat(), computeMetrics(), dateKey(), directionalReport(), fmt(), fmtDir(), main(), versionOf() (+18 more)

### Community 8 - "Community 8"
Cohesion: 0.08
Nodes (7): computeCompliant(), enrichExcessReturns(), fetchCongressTrades(), isoToUnixSeconds(), readableAssetType(), returnSince(), rowToCongressTrade()

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (26): clampConfidence(), createPredictionId(), loadLocalEnv(), magnitudeFromConfidence(), main(), parseFrontmatter(), readHeadline(), readReason() (+18 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (18): getHistory(), startPolygonFetch(), enqueuePolygon(), fetchCandlesPolygon(), fetchOHLCPolygon(), fetchPolygonNews(), computeAtr14(), computeRsi14() (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (17): buyRatio(), classifyMomentum(), loadAllNews(), loadSupplyChainSource(), logReturns(), parseFrontmatter(), pct(), pearson() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.1
Nodes (6): HttpAccountClient, dedupeStories(), jaccard(), normalizeHeadline(), pickCanonical(), UnionFind

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (6): formatCurrency(), formatGainLoss(), calculateSentimentMetrics(), clamp01(), normalizeConfidence(), verdictToPolarity()

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (4): ETradeProvider, PortfolioService, mapRawPosition(), normalizeAcquiredDate()

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (7): handleCancel(), handleKeyDown(), handleSubmit(), fallbackProfile(), fetchCompanyProfile(), normalizeKey(), resolveCoordinates()

### Community 16 - "Community 16"
Cohesion: 0.21
Nodes (13): addDays(), dateKey(), fetchFinnhubEarnings(), getEventsSnapshot(), getFallbackMacroEvents(), getUpcomingEarnings(), uniqSortedTickers(), buildNoteContent() (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.23
Nodes (10): extractTransactions(), fetchCongressTrades(), fetchPayload(), fetchTickerTrades(), fetchTickerTradesUncached(), findMemberArray(), getDataBag(), getPoliticianDirectory() (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.3
Nodes (12): checksumSeed(), ensureLicensedOrTrial(), getLicensePath(), getLicenseStatus(), getUserDataPath(), isValidLicenseKeyFormat(), readLicenseState(), readState() (+4 more)

### Community 20 - "Community 20"
Cohesion: 0.28
Nodes (11): aggregateTickerBuyCountsLast30Days(), buildContradictionAlertContent(), detectClusteringAnomalies(), detectContradictions(), meanAbsCorrelationToPortfolio(), readSubagentPrompt(), resolveContradictionWithMetaAnalyst(), runAlertsPass() (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (6): analysisKey(), cancelStockAgent(), getAgentProgress(), getOrInitTickerAnalysis(), getTickerAnalysisProgress(), setTickerAnalysis()

### Community 23 - "Community 23"
Cohesion: 0.38
Nodes (9): frontmatterHasCatalysts(), injectCatalystsIntoFrontmatter(), loadLocalEnv(), main(), parseScalarField(), readHeadline(), readReason(), rewriteFile() (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (5): daysAgo(), fetchFinnhubNews(), fetchQuote(), requireKey(), today()

### Community 25 - "Community 25"
Cohesion: 0.44
Nodes (7): appRootPath(), createMainWindow(), ensureUserDataConfigFiles(), iconPath(), parseEnvFile(), startNextServer(), userDataPath()

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (7): applyProposal(), buildEngineLeaderboard(), buildProposal(), formatDriftLine(), loadLocalEnv(), main(), pct()

### Community 27 - "Community 27"
Cohesion: 0.36
Nodes (5): dotFillPolygon(), latLonToVector3(), processDots(), srgbToLinear(), verdictColor()

### Community 28 - "Community 28"
Cohesion: 0.46
Nodes (1): DiskCache

### Community 29 - "Community 29"
Cohesion: 0.52
Nodes (6): bar(), flag(), hr(), main(), renderStory(), tags()

### Community 30 - "Community 30"
Cohesion: 0.43
Nodes (4): formatCountdown(), getMarketStatus(), minutesFromMidnight(), nyParts()

### Community 31 - "Community 31"
Cohesion: 0.53
Nodes (4): main(), migrateViaPg(), migrateViaSupabase(), walkDir()

### Community 32 - "Community 32"
Cohesion: 0.6
Nodes (5): ensureModeChosen(), getModePath(), promptForMode(), readMode(), writeMode()

### Community 33 - "Community 33"
Cohesion: 0.7
Nodes (4): computeHeuristicRelevance(), parseFrontmatter(), repairVault(), resolveVaultPath()

### Community 34 - "Community 34"
Cohesion: 0.5
Nodes (2): buildRelevanceProfile(), escapeRegex()

### Community 35 - "Community 35"
Cohesion: 0.4
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 0.67
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
- **Thin community `Community 37`** (2 nodes): `instrumentation.node.ts`, `register()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `FinnhubBadge.tsx`, `FinnhubBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `TopBarDivider.tsx`, `TopBarDivider()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `flag-emoji.ts`, `flagEmoji()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `instrumentation.ts`, `register()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `electron-builder.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `PolygonBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `modePreload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `licensePreload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._