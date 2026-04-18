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

## Verdict Rules

### BUY signals
- Earnings beat with raised guidance (both required for high confidence)
- Earnings beat alone (moderate confidence — guidance matters more)
- Analyst upgrade with a specific price target increase
- New major contract or partnership with disclosed revenue impact
- Product launch that expands total addressable market
- Share buyback above 5% of float
- M&A where the company is the acquirer at a reasonable multiple
- Supply chain event that uniquely benefits the focal ticker (e.g. competitor fab fire)

### SELL signals
- Earnings miss with lowered guidance (both required for high confidence)
- Earnings miss alone (moderate confidence)
- Analyst downgrade with specific concerns cited
- CEO or CFO departure (weigh heavier than other C-suite)
- Regulatory investigation or lawsuit with material financial exposure
- Guidance cut without a miss (pre-announcement of weakness)
- Data breach, recall, or scandal with reputational damage
- Supply chain disruption directly impacting the focal ticker's production

### HOLD signals
- Sector-wide news not specific to this company
- Earnings in-line with expectations, guidance unchanged
- Speculative rumor without confirmed sources
- Macro commentary (Fed, rates, inflation) unless company has direct exposure
- Analyst note reiterating existing rating
- Ambiguous headline with insufficient detail in the summary

### Confidence calibration
- 0.85–0.95: Direct, company-specific, hard data (earnings numbers, concrete guidance)
- 0.65–0.84: Credible signal but softer evidence (analyst opinion, partnership without financials)
- 0.50–0.64: Weak signal, mostly HOLD territory, limited info
- Below 0.50: Don't use — return HOLD at 0.50 instead

## Examples

### Example 1
Headline: "US imposes new export restrictions on advanced semiconductors to China"
→ verdict: "SELL", confidence: 0.78
→ reason: "Export controls directly cap NVDA's China data center revenue."
→ sector_tags: ["semiconductors", "export controls"]
→ affected_tickers: [any chip stocks in holdings]
→ origin_country_code: "US"
→ relevance_score: 0.88

### Example 2
Headline: "TSMC reports record quarterly revenue on AI chip demand"
→ verdict: "BUY", confidence: 0.82
→ reason: "TSMC's record revenue signals strong downstream demand benefiting NVDA's supply chain."
→ sector_tags: ["semiconductors", "AI"]
→ affected_tickers: [NVDA, AMD, INTC if in holdings]
→ origin_country_code: "TW"
→ relevance_score: 0.92 if TSMC is a holding, 0.72 if only indirect chip holdings

### Example 3
Headline: "Federal Reserve hints at rate cuts in Q4"
→ verdict: "HOLD", confidence: 0.55
→ reason: "Rate cut expectations provide modest tailwind but insufficient to move the needle alone."
→ sector_tags: ["macroeconomics", "interest rates"]
→ affected_tickers: [all growth/tech stocks broadly]
→ origin_country_code: "US"
→ relevance_score: 0.25
