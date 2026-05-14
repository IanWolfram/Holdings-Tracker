# Graph Report - .  (2026-05-14)

## Corpus Check
- Large corpus: 228 files · ~96,686 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 833 nodes · 1451 edges · 56 communities detected
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
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
- `Economic Brain Agent` --semantically_similar_to--> `V2 Alpha Analysis Protocol`  [INFERRED] [semantically similar]
  agents/economic-brain/AGENT.md → world-brain/agents/AGENT.md
- `DeepSeek API Integration` --semantically_similar_to--> `Apple MLX AI Engine`  [INFERRED] [semantically similar]
  CLAUDE.md → README.md
- `Economic Brain Classification Rules` --semantically_similar_to--> `V2 BUY Signal Rules`  [INFERRED] [semantically similar]
  agents/economic-brain/rules.md → world-brain/sector-rules.md
- `Economic Brain Classification Rules` --semantically_similar_to--> `V2 SELL Signal Rules`  [INFERRED] [semantically similar]
  agents/economic-brain/rules.md → world-brain/sector-rules.md
- `getLicensePath()` --calls--> `getUserDataPath()`  [EXTRACTED]
  electron/license.js → lib/license.ts

## Hyperedges (group relationships)
- **Sentiment Classification Pipeline** — agent_v2_protocol, sector_rules_sector_keywords, sector_rules_confidence_calibration, economic_brain_agent [EXTRACTED 0.90]
- **Recalibration Feedback Loop** — recalibration_system, recalibration_drift_detection, sector_rules_calibration_provenance, forecaster_role [EXTRACTED 0.85]
- **Supply Chain to Verdict Pipeline** — supply_chain_why_edges_matter, sector_rules_geographic_rules, agent_v2_protocol [INFERRED 0.75]

## Communities

### Community 0 - "Dashboard UI & Hooks"
Cohesion: 0.04
Nodes (13): handleCancel(), handleKeyDown(), handleSubmit(), formatCountdown(), getMarketStatus(), minutesFromMidnight(), nyParts(), newConversation() (+5 more)

### Community 1 - "API Routes & Services"
Cohesion: 0.05
Nodes (20): detectTickers(), handler(), readLatestDailySummary(), readLatestMacroSnapshot(), readRecentInsights(), readRecentVaultNews(), FinnhubProvider, NewsAPIProvider (+12 more)

### Community 2 - "Position Cards & News UI"
Cohesion: 0.04
Nodes (8): formatCurrency(), formatGainLoss(), glowClass(), PositionCard(), calculateSentimentMetrics(), clamp01(), normalizeConfidence(), verdictToPolarity()

### Community 3 - "3D Globe Renderer"
Cohesion: 0.05
Nodes (9): fallbackProfile(), fetchCompanyProfile(), CountryFocusPanel(), flagEmoji(), normalizeKey(), resolveCoordinates(), findCountryAtLatLon(), pointInGeoPolygon() (+1 more)

### Community 4 - "Agent Orchestration"
Cohesion: 0.07
Nodes (30): bar(), flag(), hr(), main(), renderStory(), tags(), analyzeStory(), buildCorrelatedHoldingsBlock() (+22 more)

### Community 5 - "Vault & Constants"
Cohesion: 0.06
Nodes (17): fetchTrendingTickers(), handler(), getHistory(), startPolygonFetch(), fetchNewsForTicker(), getNewsForTicker(), withinNewsWindow(), enqueuePolygon() (+9 more)

### Community 6 - "Classification & Congress"
Cohesion: 0.07
Nodes (17): classifyNews(), findInVault(), keywordClassify(), ClassifierService, dedupeStories(), jaccard(), normalizeHeadline(), pickCanonical() (+9 more)

### Community 7 - "Cache Infrastructure"
Cohesion: 0.07
Nodes (7): DiskCache, ETradeProvider, MapCache, PortfolioService, enrichWithCompanyNames(), enrichWithHistory(), handler()

### Community 8 - "News Backfill Scripts"
Cohesion: 0.1
Nodes (20): frontmatterHasCatalysts(), injectCatalystsIntoFrontmatter(), loadLocalEnv(), main(), parseScalarField(), readHeadline(), readReason(), rewriteFile() (+12 more)

### Community 9 - "Calibration & Vault Store"
Cohesion: 0.1
Nodes (5): FsVaultStore, reconstructMarkdown(), serializeFrontmatter(), splitFrontmatter(), SupabaseVaultStore

### Community 10 - "Calibration Backfill"
Cohesion: 0.13
Nodes (26): clampConfidence(), createPredictionId(), findBarOnOrAfter(), findBarOnOrBefore(), loadLocalEnv(), magnitudeFromConfidence(), main(), parseFrontmatter() (+18 more)

### Community 11 - "HTTP Client & Browser"
Cohesion: 0.08
Nodes (2): HttpAccountClient, SupabaseAccountInfoProvider

### Community 12 - "Earnings Events"
Cohesion: 0.14
Nodes (21): addDays(), dateKey(), fetchFinnhubEarnings(), getEventsSnapshot(), getFallbackMacroEvents(), getUpcomingEarnings(), uniqSortedTickers(), buildSummary() (+13 more)

### Community 13 - "Sector Graph & Analysis"
Cohesion: 0.15
Nodes (20): buyRatio(), classifyMomentum(), ensureDir(), loadAllNews(), loadSupplyChainSource(), logReturns(), parseFrontmatter(), pct() (+12 more)

### Community 14 - "World Brain Agents"
Cohesion: 0.08
Nodes (26): Earnings Season Context Rules, Holdings Context Constraint, Staleness Penalty System, V2 Alpha Analysis Protocol, Archivist Agent Role, Economic Brain Agent, Economic Brain Classification Rules, Horizon-Specific Signal Weighting (+18 more)

### Community 15 - "Debug & News Fetch"
Cohesion: 0.17
Nodes (13): daysAgo(), fetchFinnhubNews(), fetchQuote(), requireKey(), today(), buildTickerKnowledge(), getRecentVaultStories(), getSubagentPrompt() (+5 more)

### Community 16 - "License Management"
Cohesion: 0.2
Nodes (12): checksumSeed(), ensureLicensedOrTrial(), getLicensePath(), getLicenseStatus(), getUserDataPath(), isValidLicenseKeyFormat(), readLicenseState(), readState() (+4 more)

### Community 17 - "Alert Detection Engine"
Cohesion: 0.33
Nodes (14): aggregateTickerBuyCountsLast30Days(), buildContradictionAlertContent(), detectClusteringAnomalies(), detectContradictions(), ensureDir(), loadJson(), meanAbsCorrelationToPortfolio(), readSubagentPrompt() (+6 more)

### Community 18 - "Vault Metadata & Testing"
Cohesion: 0.28
Nodes (12): appendVaultLog(), buildVerdictTrend(), dailySummary(), findRecentContradictions(), findTopRecentStories(), nowStamp(), parseFrontmatter(), readDirSafe() (+4 more)

### Community 19 - "Price Computation"
Cohesion: 0.32
Nodes (14): computeAtr14(), computeRsi14(), dedupeAndSortBars(), fetchBarsFromSource(), fetchFinnhubDailyBars(), fetchPolygonDailyBars(), fetchYahooDailyBars(), getDailyBars() (+6 more)

### Community 20 - "E*TRADE OAuth"
Cohesion: 0.39
Nodes (13): accessToken(), buildOAuth(), fetchAccountIdKey(), fetchPortfolio(), fromCache(), getAccessToken(), getCashBalance(), getPositions() (+5 more)

### Community 21 - "News Service Core"
Cohesion: 0.24
Nodes (2): NewsService, withinNewsWindow()

### Community 22 - "Electron Main Process"
Cohesion: 0.44
Nodes (7): appRootPath(), createMainWindow(), ensureUserDataConfigFiles(), iconPath(), parseEnvFile(), startNextServer(), userDataPath()

### Community 23 - "Data Flow Documentation"
Cohesion: 0.25
Nodes (9): Data Flow Architecture, DeepSeek API Integration, Dual Routing Decision, Per-User Cache Scoping, E*TRADE Position Aggregation, Apple MLX AI Engine, News Aggregator, Pulse (Holdings Tracker) (+1 more)

### Community 24 - "Encryption & Storage Docs"
Cohesion: 0.25
Nodes (9): App-Layer Encryption Decision, AES-256-GCM Token Encryption, Cloud Mode, Electron Desktop App, FsVaultStore, handle_new_user() Trigger, Personal Mode, Supabase Auth (+1 more)

### Community 25 - "Recalibration Engine"
Cohesion: 0.5
Nodes (7): applyProposal(), buildEngineLeaderboard(), buildProposal(), formatDriftLine(), loadLocalEnv(), main(), pct()

### Community 26 - "Geo Worker Processing"
Cohesion: 0.36
Nodes (5): dotFillPolygon(), latLonToVector3(), processDots(), srgbToLinear(), verdictColor()

### Community 27 - "Vault Migration"
Cohesion: 0.53
Nodes (4): main(), migrateViaPg(), migrateViaSupabase(), walkDir()

### Community 28 - "Electron Mode System"
Cohesion: 0.6
Nodes (5): ensureModeChosen(), getModePath(), promptForMode(), readMode(), writeMode()

### Community 29 - "Vault Tag Repair"
Cohesion: 0.7
Nodes (4): computeHeuristicRelevance(), parseFrontmatter(), repairVault(), resolveVaultPath()

### Community 30 - "Logo Texture Loading"
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

### Community 35 - "Sector Supply Chain Rules"
Cohesion: 1.0
Nodes (2): Geographic Relevance Rules, NVDA→TSMC Supply Chain

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (2): V2 Cloud/Database Nuance (MDB), MDB Multi-Cloud Hosting

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (2): V2 Government Services Nuance (MMS), MMS→State Medicaid Concentration Risk

### Community 38 - "Supply Chain Rendering"
Cohesion: 1.0
Nodes (2): Supply Chain Graph Renderer, Why Supply Chain Edges Matter

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (2): V2 AI/Defense Tech Nuance (PLTR), PLTR→NVDA Supply Chain

### Community 40 - "E*TRADE Brand Assets"
Cohesion: 1.0
Nodes (2): E*TRADE Logo (public), E*TRADE Logo (root)

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
Nodes (1): Real-time Portfolio Dashboard

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (1): 3D Globe Intelligence View

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (1): PLTR→AWS Supply Chain

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (1): NVDA→ASML Supply Chain

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (1): V2 Cybersecurity Nuance (CHKP)

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (1): V2 Industrial REIT Nuance (RXD)

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (1): Reddit Logo

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (1): Finnhub Logo

## Knowledge Gaps
- **35 isolated node(s):** `Real-time Portfolio Dashboard`, `3D Globe Intelligence View`, `FsVaultStore`, `handle_new_user() Trigger`, `Per-User Cache Scoping` (+30 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 31`** (2 nodes): `instrumentation.node.ts`, `register()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `instrumentation.ts`, `register()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (2 nodes): `FinnhubBadge.tsx`, `FinnhubBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (2 nodes): `signout.ts`, `handler()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Sector Supply Chain Rules`** (2 nodes): `Geographic Relevance Rules`, `NVDA→TSMC Supply Chain`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `V2 Cloud/Database Nuance (MDB)`, `MDB Multi-Cloud Hosting`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `V2 Government Services Nuance (MMS)`, `MMS→State Medicaid Concentration Risk`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supply Chain Rendering`** (2 nodes): `Supply Chain Graph Renderer`, `Why Supply Chain Edges Matter`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `V2 AI/Defense Tech Nuance (PLTR)`, `PLTR→NVDA Supply Chain`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `E*TRADE Brand Assets`** (2 nodes): `E*TRADE Logo (public)`, `E*TRADE Logo (root)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `electron-builder.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `PolygonBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `modePreload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `licensePreload.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `Real-time Portfolio Dashboard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `3D Globe Intelligence View`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `PLTR→AWS Supply Chain`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `NVDA→ASML Supply Chain`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `V2 Cybersecurity Nuance (CHKP)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `V2 Industrial REIT Nuance (RXD)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `Reddit Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `Finnhub Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `NewsService` connect `News Service Core` to `Classification & Congress`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `Real-time Portfolio Dashboard`, `3D Globe Intelligence View`, `FsVaultStore` to the rest of the system?**
  _35 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard UI & Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `API Routes & Services` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Position Cards & News UI` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `3D Globe Renderer` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Agent Orchestration` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._