# Sector & Verdict Rules

## Live Portfolio Tickers
CHKP (Check Point Software — Cybersecurity), HOOD (Robinhood — Fintech/Brokerage), MDB (MongoDB — Cloud/Database), MMS (Maximus — Government Services/Professional Services), PLTR (Palantir — AI/Defense Tech), RXD (Rexford Industrial — Industrial REIT)

## Sector Keywords → Affected Stock Categories

| When news mentions... | Consider sector: | Live tickers affected |
|---|---|---|
| cyber, hack, breach, ransomware, zero-day, vulnerability, firewall, endpoint, SIEM | Tech > Cybersecurity | CHKP |
| AI, machine learning, neural network, LLM, inference, training, data center GPU | Tech > AI Infrastructure | PLTR, MDB |
| database, NoSQL, document store, vector DB, Atlas, MongoDB | Tech > Cloud/Database | MDB |
| cloud, hyperscaler, AWS, Azure, GCP, data center capacity | Tech > Cloud | MDB, PLTR |
| government contract, defense, DoD, federal, intelligence community, national security | Defense/Gov Tech | PLTR, MMS |
| brokerage, retail investing, crypto, options volume, trading platform, PFOF | Fintech/Brokerage | HOOD |
| interest rate, Fed, FOMC, inflation, CPI, Treasury yield | Financial sector + growth stocks | HOOD, PLTR, MDB |
| tariffs, trade war, sanctions, export ban, import duty | Cross-sector — check all holdings | CHKP, MDB, PLTR |
| industrial real estate, warehouse, logistics, REIT, industrial vacancy | Real Estate > Industrial | RXD |
| government spending, federal budget, CMS, Medicare, Medicaid, contract awards | Government Services | MMS |
| semiconductors, chips, fab, wafer, lithography, foundry | Tech > Semiconductors | PLTR (AI compute dependency) |
| pharma, drug, FDA, clinical trial | Healthcare > Pharma | (no direct exposure) |

## Relevance Score Thresholds

| Connection type | Score range |
|---|---|
| Ticker mentioned directly by name | 0.90 – 0.99 |
| Same sector, news in company's home country | 0.75 – 0.90 |
| Same sector, news from supply chain country | 0.60 – 0.80 |
| Same sector, different country | 0.50 – 0.70 |
| Adjacent/related sector | 0.25 – 0.50 |
| Macroeconomic (affects all stocks broadly) | 0.15 – 0.35 |
| Unrelated to any holding | < 0.15 → set to 0, do not include in affected_tickers |

## Geographic Rules

- US cybersecurity legislation or breach disclosure → high relevance for CHKP
- Israel-region geopolitical tension → high relevance for CHKP (HQ in Tel Aviv)
- US federal budget, continuing resolution, or CMS contract awards → high relevance for MMS
- Taiwan or China semiconductor friction → moderate relevance for PLTR (AI compute dependency)
- US industrial real estate market data → high relevance for RXD
- News origin unclear → "origin_country_code": null

## Sector-Specific V2 Nuance

### Fintech/Brokerage (HOOD)
Broad market volatility and "Risk-On" sentiment (even if speculative) usually drive **higher transaction volume** — this is a **REVENUE TAILWIND** for Robinhood, not a risk. Only classify volatility as SELL if it leads to systemic platform risk (liquidity crunch, regulatory shutdown, PFOF ban). Crypto rallies, Nasdaq swings, and retail trading surges are BUY signals for HOOD due to increased fee and spread capture.

### Cybersecurity (CHKP)
High-profile breaches at other companies are REVENUE TAILWINDS for CHKP (enterprises rush to buy security products). Only classify as SELL if: (1) the breach is AT Check Point itself, (2) a direct competitor wins a major government contract, or (3) a regulatory ruling undermines their product category. Analyst upgrades from security-specialist firms carry higher weight than generalist ratings.

### AI/Defense Tech (PLTR)
Government contract wins are high-conviction BUY signals regardless of size — they signal renewed trust and pipeline expansion. Earnings beats paired with commercial ARR growth are the gold standard. Be cautious with valuation-based SELL calls — PLTR trades on narrative; DCF-based downgrades have historically been poor short-term signals. SNB or institutional index rebalancing events (forced selling) are NOT fundamental signals — treat as short-term noise at max 0.60 confidence.

### Cloud/Database (MDB)
Atlas ARR growth and cloud adoption metrics are the primary revenue indicators — weight these above total revenue. Developer community adoption announcements and hyperscaler marketplace integrations are moderate BUY signals (0.65–0.80). Competitive threats from AWS DocumentDB or other managed MongoDB-compatible services are legitimate SELL/HOLD catalysts.

### Government Services (MMS)
Federal budget news, CMS contract awards, and government agency expansions are the primary catalysts. Analyst upgrades (especially Zacks Rank changes) carry high weight for this low-volatility name. Broad macro news rarely moves MMS — its revenue is government-contracted and largely insulated from market sentiment.

### Industrial REIT (RXD)
Industrial vacancy rates, Southern California industrial market data, and interest rate movements are primary catalysts. Rate cuts are BUY signals (lower cap rates, higher property valuations). Rate hikes are SELL signals. E-commerce logistics demand announcements are moderate BUY signals. Treat as income-oriented — dividend stability news matters.

## Verdict Rules (V2 Weights)

### BUY signals (High Conviction)
- **Zacks Rank #1 (Strong Buy)**: Automatic high-confidence BUY if fundamentals are mentioned.
- **Analyst Upgrade + >20% Price Target Increase**: High confidence, especially from Tier-1 firms (Goldman, MS, JPM, Wedbush).
- **Earnings Beat + GUIDANCE RAISE**: The gold standard. 0.90+ confidence.
- **Share Buyback > $1Bn**: Major institutional conviction signal.
- **Strategic Partnership (Fortune 500)**: Direct path to revenue.
- **Government contract win (PLTR, MMS)**: High conviction, signals pipeline health.

### BUY signals (Moderate Conviction)
- Insider buying (weighted by dollar amount).
- Sector-wide tailwind directly applicable to business model.
- Post-drop "Value" call if fundamentals remain intact.
- Breach news at competitor (CHKP only).

### SELL signals
- Guidance cut (even if earnings beat).
- Regulatory crackdown directly targeting the business model (e.g., PFOF ban for HOOD, export controls for PLTR's international ops).
- Executive departure under pressure (CEO/CFO weight higher than other C-suite).
- Disastrous data breach or security failure — especially critical for CHKP and PLTR given trust-dependent business models.
- REIT: sustained interest rate increase cycle (RXD).

## Confidence Calibration
- **0.90+**: Hard data (Earnings, Ranks, Formal Guidance, Signed Contracts).
- **0.75–0.89**: Strong analyst support, major strategic wins, or government contract awards.
- **0.60–0.74**: Sentiment-driven or indirect sector tailwinds.
- **Below 0.60**: Lean toward HOLD unless catalyst is directly company-specific.

## Examples (V2 Logic)

### Example 1 — Brokerage Volatility Tailwind
Headline: "Market volatility spikes as Nasdaq swings 3% on rate fears"
→ verdict: "BUY", confidence: 0.75
→ reason: "Intraday volatility serves as a revenue catalyst for HOOD by driving increased retail trading volume and spread capture."
→ sector_tags: ["fintech", "volatility"]
→ origin_country_code: "US"
→ relevance_score: 0.85
→ geo_summary: "-"

### Example 2 — Government Contract Win
Headline: "Palantir wins $400M DoD contract for battlefield AI platform"
→ verdict: "BUY", confidence: 0.92
→ reason: "Direct $400M DoD contract win confirms PLTR's position in defense AI and expands government ARR pipeline."
→ sector_tags: ["defense", "AI Infrastructure", "government"]
→ origin_country_code: "US"
→ relevance_score: 0.99
→ geo_summary: "-"

### Example 3 — Cybersecurity Breach (Competitor)
Headline: "Major enterprise hit by ransomware attack, exposing 50M records"
→ verdict: "BUY", confidence: 0.72
→ reason: "High-profile breach accelerates enterprise security spend, directly expanding CHKP's addressable sales pipeline."
→ sector_tags: ["cybersecurity"]
→ origin_country_code: "US"
→ relevance_score: 0.80
→ geo_summary: "-"

### Example 4 — MMS Analyst Upgrade
Headline: "MMS joins Zacks Rank #1 (Strong Buy) List"
→ verdict: "BUY", confidence: 0.92
→ reason: "Zacks Rank #1 confirms superior earnings estimate revisions and high fundamental strength for this government-contracted services firm."
→ sector_tags: ["Professional Services", "Value"]
→ origin_country_code: "US"
→ relevance_score: 0.98
→ geo_summary: "-"
