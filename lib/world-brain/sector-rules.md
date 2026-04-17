# Sector-to-Ticker Mapping Rules

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

- If the news is about a US trade restriction on China chips → "origin_country_code": "US", high relevance for semiconductor holdings from both US and TW/KR
- If the news is about a Taiwan earthquake affecting fabs → "origin_country_code": "TW", very high relevance for chip stocks
- If the news is a UK pharmaceutical approval → "origin_country_code": "GB", high relevance for pharma holdings
- If the news origin is unclear → "origin_country_code": null

## Examples

### Example 1
Headline: "US imposes new export restrictions on advanced semiconductors to China"
→ sector_tags: ["semiconductors", "export controls"]
→ affected_tickers: [any chip stocks in holdings]
→ origin_country_code: "US"
→ relevance_score: 0.88

### Example 2
Headline: "TSMC reports record quarterly revenue on AI chip demand"
→ sector_tags: ["semiconductors", "AI"]
→ affected_tickers: [NVDA, AMD, INTC if in holdings — supply chain beneficiaries]
→ origin_country_code: "TW"
→ relevance_score: 0.92 if TSMC is a holding, 0.72 if only indirect chip holdings

### Example 3
Headline: "Federal Reserve hints at rate cuts in Q4"
→ sector_tags: ["macroeconomics", "interest rates"]
→ affected_tickers: [all growth/tech stocks broadly]
→ origin_country_code: "US"
→ relevance_score: 0.25 (macro, broadly applicable but indirect)
