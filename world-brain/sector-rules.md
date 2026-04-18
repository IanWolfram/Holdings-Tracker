# Sector & Verdict Rules

## Sector Keywords → Affected Stock Categories

| When news mentions... | Consider sector: |
|---|---|
| semiconductors, chips, fab, wafer, lithography, node, foundry, TSMC, ASML | Tech > Semiconductors |
| AI, machine learning, neural network, GPU, LLM, inference, training, data center GPU | Tech > AI Infrastructure |
| cloud, hyperscaler, AWS, Azure, GCP, data center capacity, CDN | Tech > Cloud |
| EV, electric vehicle, battery, charging, lithium, cathode, BEV | Consumer Discretionary > EV |
| pharma, drug, FDA, clinical trial, biologics, biosimilar, approval | Healthcare > Pharma |
| biotech, CRISPR, gene therapy, genomics | Healthcare > Biotech |
| tariffs, trade war, sanctions, export ban, import duty, Section 301 | Cross-sector — check all holdings |
| interest rate, Fed, FOMC, inflation, CPI, Treasury yield | Financial sector + growth stocks |
| oil, gas, energy, OPEC, crude, refinery, LNG | Energy sector |
| cyber, hack, breach, ransomware, zero-day, vulnerability | Tech > Cybersecurity |
| consumer spending, retail, e-commerce, holiday sales | Consumer Discretionary |
| banking, credit, default, deposit, SVB-style | Financial sector |
| drought, yield, crop, harvest, soybean, corn, wheat, agricultural | Agriculture / Industrials (equipment) |

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

- US trade restriction on China chips → "origin_country_code": "US", high relevance for semiconductor holdings from US and TW/KR
- Taiwan earthquake affecting fabs → "origin_country_code": "TW", very high relevance for chip stocks
- UK pharmaceutical approval → "origin_country_code": "GB", high relevance for pharma holdings
- Brazil drought → "origin_country_code": "BR", high relevance for agriculture/equipment holdings
- News origin unclear → "origin_country_code": null

## Sector-Specific V2 Nuance

### Tech & Fintech (Brokerages)
- **HOOD, SCHW, IBKR**: Note that broad market volatility and "Risk-On" sentiment (even if speculative) usually drive **higher transaction volume**. Only classify volatility as "SELL" if it leads to systemic platform risk (e.g. liquidity crunch). Otherwise, treat crypto-rally or Nasdaq-swing news as **BUY** due to revenue tailwinds.

### Semiconductors
- **NVDA, PLTR, AMD**: AI infra partnerships with hyperscalers (Stellantis, Microsoft, Google) are high-conviction catalysts. Weight "Industrialization of AI" news heavier than "Retail AI" hype.

## Verdict Rules (V2 Weights)

### BUY signals (High Conviction)
- **Zacks Rank #1 (Strong Buy)**: Automatic high-confidence BUY if fundamentals are mentioned.
- **Analyst Upgrade + >20% Price Target Increase**: High confidence, especially from Tier-1 firms (Goldman, MS, JPM, Wedbush).
- **Earnings Beat + GUIDANCE RAISE**: The gold standard. 0.90+ confidence.
- **Share Buyback > $1Bn**: Major institutional conviction signal.
- **Strategic Partnership (Fortune 500)**: Direct path to revenue.

### BUY signals (Moderate Conviction)
- Insider buying (weighted by dollar amount).
- Sector-wide tailwind (e.g., Bitcoin rally for HOOD).
- Post-drop "Value" call if fundamentals remain intact.

### SELL signals
- Guidance cut (even if earnings beat).
- Regulatory crackdown directly targeting the business model (e.g., SEC vs. Payment for Order Flow).
- Executive departure under pressure.
- Disastrous data breach or security failure (especially for PLTR/CHKP).

## Confidence calibration
- **0.90+**: Hard data (Earnings, Ranks, Formal Guidance).
- **0.75-0.89**: Strong analyst support or major strategic wins.
- **0.60-0.74**: Sentiment-driven or indirect sector tailwinds.

## Examples (V2 Logic)

### Example 1 — Contradiction Handling
Headline: "Cathie Wood Sells $2M in Crypto Stocks but adds $12M to Robinhood Position"
→ verdict: "BUY", confidence: 0.88
→ reason: "Net positioning shows a massive $10M institutional inflow into HOOD, confirming strong conviction despite broader crypto rebalancing."
→ sector_tags: ["fintech", "institutional activity"]
→ origin_country_code: "US"
→ relevance_score: 0.95

### Example 2 — Brokerage Volatility
Headline: "Market volatility spikes as Nasdaq swings 3% on rate fears"
→ verdict: "BUY", confidence: 0.75
→ reason: "Intraday volatility serves as a revenue catalyst for HOOD by driving increased retail trading volume and spread capture."
→ sector_tags: ["financial services", "volatility"]
→ origin_country_code: "US"
→ relevance_score: 0.85

### Example 3 — Fundamental Catalyst
Headline: "MMS joins Zacks Rank #1 (Strong Buy) List"
→ verdict: "BUY", confidence: 0.92
→ reason: "Inclusion in Zacks Rank #1 confirms superior earnings estimate revisions and high fundamental strength."
→ sector_tags: ["Professional Services", "Value"]
→ origin_country_code: "US"
→ relevance_score: 0.98
