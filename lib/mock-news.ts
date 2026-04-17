import type { ClassifiedStory } from "./news";

const now = Math.floor(Date.now() / 1000);
const h = (n: number) => now - n * 3600; // hours ago

export const MOCK_NEWS: Record<string, ClassifiedStory[]> = {
  BR: [
    {
      ticker: "BR", source: "finnhub", datetime: h(1),
      headline: "Broadridge Financial beats Q3 earnings estimates, raises full-year guidance",
      summary: "Broadridge reported EPS of $1.84 vs $1.71 expected, driven by strong recurring revenue growth in its investor communications segment.",
      url: "#", verdict: "BUY", confidence: 0.91, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "BR", source: "twitter", datetime: h(3), author: "FinancialTimes",
      headline: "BR stock upgrades from two analysts following strong wealth management platform adoption numbers.",
      summary: "BR stock upgrades from two analysts following strong wealth management platform adoption numbers.",
      url: "#", verdict: "BUY", confidence: 0.78, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "BR", source: "finnhub", datetime: h(18),
      headline: "Broadridge expands partnership with major European asset managers for back-office automation",
      summary: "The deal is expected to add $40M in ARR over the next two years.",
      url: "#", verdict: "BUY", confidence: 0.83, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "BR", source: "finnhub", datetime: h(30),
      headline: "Fintech sector faces regulatory scrutiny over data handling practices",
      summary: "SEC is reviewing data sharing agreements across several financial technology firms.",
      url: "#", verdict: "HOLD", confidence: 0.61, classifiedAt: new Date().toISOString(),
    },
  ],

  GLD: [
    {
      ticker: "GLD", source: "finnhub", datetime: h(2),
      headline: "Gold surges to 3-month high as Fed signals pause in rate hike cycle",
      summary: "Spot gold rose 1.4% to $2,041/oz after Fed minutes showed growing dissent over further tightening.",
      url: "#", verdict: "BUY", confidence: 0.88, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "GLD", source: "twitter", datetime: h(5), author: "KitcoNews",
      headline: "Central banks globally added 290 tonnes of gold in Q1 — strongest quarter in decades.",
      summary: "Central banks globally added 290 tonnes of gold in Q1 — strongest quarter in decades.",
      url: "#", verdict: "BUY", confidence: 0.85, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "GLD", source: "finnhub", datetime: h(20),
      headline: "Dollar strengthens on better-than-expected jobs data, pressuring commodity prices",
      summary: "Nonfarm payrolls came in at 272k vs 185k expected, boosting DXY and weighing on gold.",
      url: "#", verdict: "SELL", confidence: 0.72, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "GLD", source: "finnhub", datetime: h(40),
      headline: "GLD ETF sees record weekly inflows of $1.2B from institutional investors",
      summary: "SPDR Gold Shares logged its largest single-week inflow since 2020.",
      url: "#", verdict: "BUY", confidence: 0.80, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "GLD", source: "twitter", datetime: h(48), author: "BloombergMkts",
      headline: "Geopolitical tensions in Middle East driving safe-haven flows into gold and treasuries.",
      summary: "Geopolitical tensions in Middle East driving safe-haven flows into gold and treasuries.",
      url: "#", verdict: "BUY", confidence: 0.74, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "GLD", source: "reddit", datetime: h(9), author: "u/goldbugsunite",
      headline: "GLD vs physical gold — which do you hold and why?",
      summary: "GLD vs physical gold — which do you hold and why?\n\nWith gold at all-time highs I keep going back and forth. GLD is more liquid but you don't own the metal. Curious what r/investing thinks.",
      url: "#", verdict: "HOLD", confidence: 0.55, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "GLD", source: "newsapi", datetime: h(15),
      headline: "Gold Hits Record High as Central Bank Demand Accelerates Into 2026",
      summary: "Spot gold touched $2,380 per ounce on Monday, propelled by continued central bank accumulation and a weaker dollar following soft US retail sales data.",
      url: "#", verdict: "BUY", confidence: 0.90, classifiedAt: new Date().toISOString(),
    },
  ],

  MSFT: [
    {
      ticker: "MSFT", source: "finnhub", datetime: h(1),
      headline: "Microsoft Azure revenue grows 31% YoY, AI services cited as primary growth driver",
      summary: "Azure and other cloud services grew 31% in the latest quarter, ahead of the 28% analyst consensus.",
      url: "#", verdict: "BUY", confidence: 0.94, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "MSFT", source: "twitter", datetime: h(4), author: "SatNadella",
      headline: "Copilot for Microsoft 365 reaches 1 million paid seats — fastest enterprise adoption in company history.",
      summary: "Copilot for Microsoft 365 reaches 1 million paid seats — fastest enterprise adoption in company history.",
      url: "#", verdict: "BUY", confidence: 0.89, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "MSFT", source: "finnhub", datetime: h(22),
      headline: "EU regulators open investigation into Microsoft's bundling of Teams with Office 365",
      summary: "The European Commission is examining whether Microsoft's software bundling practices harm competition.",
      url: "#", verdict: "SELL", confidence: 0.67, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "MSFT", source: "finnhub", datetime: h(36),
      headline: "Microsoft raises quarterly dividend 10%, announces $60B share buyback program",
      summary: "The board approved a $0.75 per share quarterly dividend and extended the buyback authorization.",
      url: "#", verdict: "BUY", confidence: 0.82, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "MSFT", source: "twitter", datetime: h(50), author: "WSJMarkets",
      headline: "Analyst consensus on MSFT remains Strong Buy with average PT of $520.",
      summary: "Analyst consensus on MSFT remains Strong Buy with average PT of $520.",
      url: "#", verdict: "HOLD", confidence: 0.58, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "MSFT", source: "reddit", datetime: h(7), author: "u/techbull99",
      headline: "Microsoft's AI push is unlike anything I've seen — here's why I'm doubling my position",
      summary: "Microsoft's AI push is unlike anything I've seen — here's why I'm doubling my position\n\nAzure OpenAI usage is exploding at my company. Every enterprise team wants Copilot. The moat is real.",
      url: "#", verdict: "BUY", confidence: 0.76, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "MSFT", source: "newsapi", datetime: h(11),
      headline: "Microsoft Unveils Next-Generation Copilot Features at Build 2026",
      summary: "Microsoft announced a sweeping set of AI updates at its annual developer conference, including autonomous agents capable of writing and deploying code without human intervention.",
      url: "#", verdict: "BUY", confidence: 0.87, classifiedAt: new Date().toISOString(),
    },
  ],

  RBL: [
    {
      ticker: "RBL", source: "finnhub", datetime: h(3),
      headline: "Rebel Wilson's production company files for expansion, analysts see media deal potential",
      summary: "Small-cap media holding RBL announced strategic review of its content portfolio.",
      url: "#", verdict: "HOLD", confidence: 0.55, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "RBL", source: "twitter", datetime: h(12), author: "SmallCapDaily",
      headline: "RBL misses Q2 revenue estimates by 8%, cites softer-than-expected ad market.",
      summary: "RBL misses Q2 revenue estimates by 8%, cites softer-than-expected ad market.",
      url: "#", verdict: "SELL", confidence: 0.76, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "RBL", source: "finnhub", datetime: h(28),
      headline: "Roblox (RBL) daily active users grow 17% YoY in latest platform metrics report",
      summary: "DAUs reached 88.9M with strong growth in the 17+ age demographic.",
      url: "#", verdict: "BUY", confidence: 0.79, classifiedAt: new Date().toISOString(),
    },
  ],

  RPI: [
    {
      ticker: "RPI", source: "finnhub", datetime: h(6),
      headline: "Inflation data comes in cooler than expected at 3.1%, boosting inflation-linked assets",
      summary: "CPI rose 3.1% YoY in the latest reading, below the 3.4% consensus estimate.",
      url: "#", verdict: "BUY", confidence: 0.70, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "RPI", source: "twitter", datetime: h(14), author: "MacroAlerts",
      headline: "Real returns on inflation-protected instruments turn positive for first time since 2021.",
      summary: "Real returns on inflation-protected instruments turn positive for first time since 2021.",
      url: "#", verdict: "BUY", confidence: 0.66, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "RPI", source: "finnhub", datetime: h(35),
      headline: "Fed holds rates steady, signals two cuts in 2025 — markets rally on dovish tone",
      summary: "The FOMC voted unanimously to hold rates at 5.25%-5.50% at today's meeting.",
      url: "#", verdict: "HOLD", confidence: 0.60, classifiedAt: new Date().toISOString(),
    },
  ],

  AAPL: [
    {
      ticker: "AAPL", source: "finnhub", datetime: h(1),
      headline: "Apple Vision Pro 2 leaks suggest 40% thinner form factor and standalone AI chip",
      summary: "Supply chain sources point to a dramatic redesign for the second-generation spatial computing headset, targeting a late-2026 launch.",
      url: "#", verdict: "BUY", confidence: 0.85, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "AAPL", source: "twitter", datetime: h(5), author: "MinchiKuo",
      headline: "Apple iPhone 17 Pro shipments tracking 12% ahead of iPhone 16 Pro cycle at same point.",
      summary: "Apple iPhone 17 Pro shipments tracking 12% ahead of iPhone 16 Pro cycle at same point.",
      url: "#", verdict: "BUY", confidence: 0.82, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "AAPL", source: "finnhub", datetime: h(18),
      headline: "EU Digital Markets Act forces Apple to allow third-party app stores in Europe",
      summary: "Apple faces ongoing compliance costs and potential revenue drag from DMA-mandated sideloading rules.",
      url: "#", verdict: "SELL", confidence: 0.63, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "AAPL", source: "newsapi", datetime: h(30),
      headline: "Apple Services revenue hits all-time high of $26.9B, margin expansion continues",
      summary: "App Store, iCloud, and Apple TV+ combined drove record gross margin of 74% in the segment.",
      url: "#", verdict: "BUY", confidence: 0.90, classifiedAt: new Date().toISOString(),
    },
  ],

  NVDA: [
    {
      ticker: "NVDA", source: "finnhub", datetime: h(2),
      headline: "NVIDIA Blackwell GPU shipments exceed 400,000 units in Q1, smashing estimates",
      summary: "Data center revenue surged 78% YoY to $22.6B as hyperscalers accelerated AI infrastructure buildout.",
      url: "#", verdict: "BUY", confidence: 0.95, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "NVDA", source: "twitter", datetime: h(6), author: "SemiAnalysis",
      headline: "NVIDIA H200 lead over AMD MI300X widens further — CUDA moat remains intact in enterprise deployments.",
      summary: "NVIDIA H200 lead over AMD MI300X widens further — CUDA moat remains intact in enterprise deployments.",
      url: "#", verdict: "BUY", confidence: 0.88, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "NVDA", source: "finnhub", datetime: h(14),
      headline: "US export controls tighten on advanced AI chips to China — NVIDIA estimates $5.5B revenue impact",
      summary: "Commerce Dept rule affects H100, H200, and Blackwell sales to mainland China buyers.",
      url: "#", verdict: "SELL", confidence: 0.78, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "NVDA", source: "reddit", datetime: h(20), author: "u/AIInvestor42",
      headline: "NVDA is the picks-and-shovels play of the AI gold rush — my thesis for $1200 PT",
      summary: "NVDA is the picks-and-shovels play of the AI gold rush — my thesis for $1200 PT\n\nEvery major AI lab, cloud, and enterprise is buying more GPUs than analysts model. CUDA lock-in is real.",
      url: "#", verdict: "BUY", confidence: 0.74, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "NVDA", source: "newsapi", datetime: h(36),
      headline: "NVIDIA announces next-generation Rubin GPU architecture, sampling to partners in H2 2026",
      summary: "Rubin promises 3x performance-per-watt improvement over Blackwell and native support for multi-agent AI workloads.",
      url: "#", verdict: "BUY", confidence: 0.87, classifiedAt: new Date().toISOString(),
    },
  ],

  JPM: [
    {
      ticker: "JPM", source: "finnhub", datetime: h(3),
      headline: "JPMorgan Chase Q1 profit jumps 9% to $14.6B, investment banking surges 45%",
      summary: "Strong M&A advisory and equity underwriting drove the beat; consumer credit remained resilient despite high rates.",
      url: "#", verdict: "BUY", confidence: 0.86, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "JPM", source: "twitter", datetime: h(9), author: "WSJMarkets",
      headline: "Jamie Dimon warns of stagflation risks in annual shareholder letter — calls it 'the most dangerous macro backdrop in 40 years'.",
      summary: "Jamie Dimon warns of stagflation risks in annual shareholder letter — calls it 'the most dangerous macro backdrop in 40 years'.",
      url: "#", verdict: "SELL", confidence: 0.60, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "JPM", source: "finnhub", datetime: h(22),
      headline: "JPMorgan raises dividend 9.5% to $1.40/share, authorizes $30B buyback",
      summary: "Capital return accelerates as CET1 ratio holds well above regulatory minimums at 15.1%.",
      url: "#", verdict: "BUY", confidence: 0.83, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "JPM", source: "newsapi", datetime: h(40),
      headline: "JPMorgan's AI-powered risk platform cuts operational losses by $1.8B in first full year",
      summary: "The bank's LLM-based fraud detection and credit decisioning tools are now live across 18 markets.",
      url: "#", verdict: "BUY", confidence: 0.79, classifiedAt: new Date().toISOString(),
    },
  ],

  XOM: [
    {
      ticker: "XOM", source: "finnhub", datetime: h(4),
      headline: "ExxonMobil Permian Basin output hits record 1.4M boe/d, driving $9.3B in quarterly FCF",
      summary: "Pioneer Energy acquisition synergies now fully reflected; management raised 2026 production target by 6%.",
      url: "#", verdict: "BUY", confidence: 0.84, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "XOM", source: "twitter", datetime: h(12), author: "EnergyIntelGroup",
      headline: "Brent crude slips to $78 on OPEC+ production hike signals — energy majors under pressure.",
      summary: "Brent crude slips to $78 on OPEC+ production hike signals — energy majors under pressure.",
      url: "#", verdict: "SELL", confidence: 0.71, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "XOM", source: "finnhub", datetime: h(26),
      headline: "ExxonMobil wins $4.9B carbon capture contract with Gulf Coast industrial consortium",
      summary: "The Baytown CCS project will sequester up to 50Mt of CO2 per year once fully operational in 2029.",
      url: "#", verdict: "BUY", confidence: 0.77, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "XOM", source: "newsapi", datetime: h(48),
      headline: "Exxon increases quarterly dividend to $0.99/share — 42nd consecutive annual raise",
      summary: "The company remains one of the most consistent dividend growers among S&P 500 energy names.",
      url: "#", verdict: "BUY", confidence: 0.80, classifiedAt: new Date().toISOString(),
    },
  ],

  AMZN: [
    {
      ticker: "AMZN", source: "finnhub", datetime: h(2),
      headline: "Amazon AWS revenue accelerates to 21% YoY growth, beating estimates by $900M",
      summary: "Generative AI workloads and enterprise cloud migrations drove the upside; operating margin expanded to 37%.",
      url: "#", verdict: "BUY", confidence: 0.92, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "AMZN", source: "twitter", datetime: h(7), author: "TechCrunch",
      headline: "Amazon Alexa+ with Claude integration reaches 50M households in 90 days — fastest AI consumer rollout ever.",
      summary: "Amazon Alexa+ with Claude integration reaches 50M households in 90 days — fastest AI consumer rollout ever.",
      url: "#", verdict: "BUY", confidence: 0.86, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "AMZN", source: "finnhub", datetime: h(20),
      headline: "FTC renewed antitrust scrutiny targets Amazon marketplace seller fees and Buy Box algorithm",
      summary: "Investigation could force structural changes to Amazon's third-party marketplace if settlement not reached.",
      url: "#", verdict: "SELL", confidence: 0.66, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "AMZN", source: "reddit", datetime: h(32), author: "u/cloudwatch_bull",
      headline: "AWS Bedrock wins are bigger than anyone realizes — here's what the enterprise sales data shows",
      summary: "AWS Bedrock wins are bigger than anyone realizes — here's what the enterprise sales data shows\n\nEvery CTO I talk to is consolidating AI inference on Bedrock. The stickiness rivals Azure OpenAI.",
      url: "#", verdict: "BUY", confidence: 0.76, classifiedAt: new Date().toISOString(),
    },
  ],

  RXD: [
    {
      ticker: "RXD", source: "finnhub", datetime: h(2),
      headline: "Healthcare sector underperforms broad market for third consecutive week amid pricing reform fears",
      summary: "The XLV ETF dropped 2.3% this week as lawmakers renewed discussion of drug price negotiation powers.",
      url: "#", verdict: "BUY", confidence: 0.73, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "RXD", source: "twitter", datetime: h(8), author: "ETFTrends",
      headline: "Inverse healthcare ETFs see elevated volume as pharma names sell off on Medicare news.",
      summary: "Inverse healthcare ETFs see elevated volume as pharma names sell off on Medicare news.",
      url: "#", verdict: "BUY", confidence: 0.81, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "RXD", source: "finnhub", datetime: h(16),
      headline: "Pfizer and Merck post better-than-expected results, healthcare index rebounds 1.8%",
      summary: "Strong pharma earnings drove XLV higher, which is a headwind for inverse positions.",
      url: "#", verdict: "SELL", confidence: 0.77, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "RXD", source: "finnhub", datetime: h(44),
      headline: "Drug pricing reform bill stalls in Senate committee, reducing near-term regulatory risk for pharma",
      summary: "The bill failed to advance out of the Senate HELP committee on a 10-10 party-line vote.",
      url: "#", verdict: "SELL", confidence: 0.69, classifiedAt: new Date().toISOString(),
    },
  ],

  ITUB: [
    {
      ticker: "ITUB", source: "finnhub", datetime: h(2),
      headline: "Itaú Unibanco reports record net income of R$10.1B in Q1 2026, up 18% YoY",
      summary: "Brazil's largest private bank beat estimates on strong loan growth and improved credit quality.",
      url: "#", verdict: "BUY", confidence: 0.88, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "ITUB", source: "twitter", datetime: h(9), author: "BrazilFinanceDesk",
      headline: "Brazil Selic rate held at 13.75% — positive for bank net interest margins heading into H2.",
      summary: "Brazil Selic rate held at 13.75% — positive for bank net interest margins heading into H2.",
      url: "#", verdict: "BUY", confidence: 0.79, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "ITUB", source: "finnhub", datetime: h(26),
      headline: "Brazilian real weakens 4% against USD on fiscal deficit concerns, pressuring ADR pricing",
      summary: "Currency headwinds could weigh on USD-denominated returns for ITUB ADR holders.",
      url: "#", verdict: "SELL", confidence: 0.71, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "ITUB", source: "newsapi", datetime: h(38),
      headline: "Itaú expands digital wallet platform to 5 new Latin American markets",
      summary: "The bank's fintech arm signed partnership agreements covering Colombia, Chile, Peru, Uruguay, and Paraguay.",
      url: "#", verdict: "BUY", confidence: 0.82, classifiedAt: new Date().toISOString(),
    },
  ],

  TM: [
    {
      ticker: "TM", source: "finnhub", datetime: h(3),
      headline: "Toyota posts strongest quarterly profit in five years on hybrid demand surge",
      summary: "Operating profit rose 28% to ¥1.1T, driven by record Prius and RAV4 Hybrid sales globally.",
      url: "#", verdict: "BUY", confidence: 0.86, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "TM", source: "twitter", datetime: h(11), author: "AutoAnalyst",
      headline: "Toyota's solid-state battery timeline slips to 2028 — EV transition risk lingers.",
      summary: "Toyota's solid-state battery timeline slips to 2028 — EV transition risk lingers.",
      url: "#", verdict: "SELL", confidence: 0.68, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "TM", source: "finnhub", datetime: h(20),
      headline: "Yen weakness boosts Toyota's export earnings — FX tailwind estimated at ¥400B for FY2026",
      summary: "Every 1-yen depreciation against the dollar adds roughly ¥45B to Toyota's annual operating profit.",
      url: "#", verdict: "BUY", confidence: 0.80, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "TM", source: "newsapi", datetime: h(48),
      headline: "Toyota to invest $8B in U.S. battery manufacturing, securing IRA tax credits through 2032",
      summary: "The investment will double capacity at its North Carolina gigafactory and create 3,000 jobs.",
      url: "#", verdict: "BUY", confidence: 0.77, classifiedAt: new Date().toISOString(),
    },
  ],

  INFY: [
    {
      ticker: "INFY", source: "finnhub", datetime: h(1),
      headline: "Infosys raises FY2026 revenue guidance to 8-10% on strong AI consulting deal flow",
      summary: "The Bengaluru-based IT giant cited accelerating enterprise AI adoption as the primary demand driver.",
      url: "#", verdict: "BUY", confidence: 0.91, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "INFY", source: "twitter", datetime: h(7), author: "TechCrunchIndia",
      headline: "Infosys wins $2.1B multi-year digital transformation contract with European financial consortium.",
      summary: "Infosys wins $2.1B multi-year digital transformation contract with European financial consortium.",
      url: "#", verdict: "BUY", confidence: 0.87, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "INFY", source: "finnhub", datetime: h(19),
      headline: "US H-1B visa scrutiny intensifies — Indian IT firms face higher operating costs for US delivery",
      summary: "Proposed H-1B reforms could add $150M-$200M in annual costs for Infosys's US workforce.",
      url: "#", verdict: "SELL", confidence: 0.65, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "INFY", source: "reddit", datetime: h(33), author: "u/emergingmktsinvestor",
      headline: "INFY is the safest play on India's tech boom — here's my 3-year thesis",
      summary: "INFY is the safest play on India's tech boom — here's my 3-year thesis\n\nWith global enterprises pouring money into AI transformation, INFY's delivery model and margin profile look increasingly compelling.",
      url: "#", verdict: "BUY", confidence: 0.72, classifiedAt: new Date().toISOString(),
    },
  ],

  LVMH: [
    {
      ticker: "LVMH", source: "finnhub", datetime: h(4),
      headline: "LVMH Q1 revenue grows 6% organically, Fashion & Leather leads with 9% gains",
      summary: "Louis Vuitton and Dior drove outperformance while wines & spirits lagged on China demand softness.",
      url: "#", verdict: "BUY", confidence: 0.83, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "LVMH", source: "twitter", datetime: h(14), author: "LuxuryIntelligence",
      headline: "Chinese luxury spending down 12% YoY in March — LVMH China exposure at 26% of revenue.",
      summary: "Chinese luxury spending down 12% YoY in March — LVMH China exposure at 26% of revenue.",
      url: "#", verdict: "SELL", confidence: 0.74, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "LVMH", source: "finnhub", datetime: h(31),
      headline: "Bernard Arnault's LVMH acquires majority stake in French jewellery house Mellerio",
      summary: "The deal adds another iconic Parisian maison to LVMH's 75-brand portfolio.",
      url: "#", verdict: "HOLD", confidence: 0.60, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "LVMH", source: "newsapi", datetime: h(52),
      headline: "Euro strength vs dollar erodes LVMH's USD-reported margins by an estimated 2.5%",
      summary: "A 5% EUR/USD appreciation reduces LVMH's translated USD operating income by roughly €380M annually.",
      url: "#", verdict: "SELL", confidence: 0.67, classifiedAt: new Date().toISOString(),
    },
  ],

  "005930": [
    {
      ticker: "005930", source: "finnhub", datetime: h(2),
      headline: "Samsung Electronics swings to profit on DRAM price recovery, HBM3 yield improvements",
      summary: "DS division posted ₩3.8T operating profit as DRAM spot prices rose 22% QoQ and HBM3 yields exceeded 70%.",
      url: "#", verdict: "BUY", confidence: 0.89, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "005930", source: "twitter", datetime: h(10), author: "SemiAnalysis",
      headline: "Samsung foundry losing ground to TSMC at 3nm — yield gap still 15-20 percentage points behind.",
      summary: "Samsung foundry losing ground to TSMC at 3nm — yield gap still 15-20 percentage points behind.",
      url: "#", verdict: "SELL", confidence: 0.72, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "005930", source: "finnhub", datetime: h(24),
      headline: "Samsung wins $6.4B DRAM supply agreement with major US hyperscaler for AI infrastructure buildout",
      summary: "The multi-year supply deal covers HBM3E modules for next-generation AI training clusters.",
      url: "#", verdict: "BUY", confidence: 0.85, classifiedAt: new Date().toISOString(),
    },
  ],

  CNQ: [
    {
      ticker: "CNQ", source: "finnhub", datetime: h(5),
      headline: "Canadian Natural Resources raises dividend 14% after record oil sands free cash flow",
      summary: "CNQ generated C$4.2B in free cash flow in Q1 as Athabasca oil sands production hit 1.4M boe/d.",
      url: "#", verdict: "BUY", confidence: 0.84, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "CNQ", source: "twitter", datetime: h(15), author: "EnergyIntelGroup",
      headline: "WTI crude falls below $75 on demand concerns — Canadian heavy oil differentials widen.",
      summary: "WTI crude falls below $75 on demand concerns — Canadian heavy oil differentials widen.",
      url: "#", verdict: "SELL", confidence: 0.70, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "CNQ", source: "finnhub", datetime: h(36),
      headline: "Trans Mountain pipeline expansion reaches full capacity — Alberta producers gain Pacific market access",
      summary: "The C$34B pipeline now moves 890,000 boe/d to Burnaby terminal, unlocking Asian premium pricing.",
      url: "#", verdict: "BUY", confidence: 0.78, classifiedAt: new Date().toISOString(),
    },
  ],

  BHP: [
    {
      ticker: "BHP", source: "finnhub", datetime: h(3),
      headline: "BHP reports record copper production, raises FY2026 output guidance by 8%",
      summary: "Escondida and Olympic Dam drove the beat; management cited improved ore grades and water recovery.",
      url: "#", verdict: "BUY", confidence: 0.87, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "BHP", source: "twitter", datetime: h(13), author: "MiningWeekly",
      headline: "Iron ore price slides to $98/tonne as Chinese steel output data disappoints for third straight month.",
      summary: "Iron ore price slides to $98/tonne as Chinese steel output data disappoints for third straight month.",
      url: "#", verdict: "SELL", confidence: 0.75, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "BHP", source: "finnhub", datetime: h(29),
      headline: "BHP acquires Chilean lithium junior for $890M, accelerating battery materials strategy",
      summary: "The Atacama acquisition adds 2.1Mt of lithium carbonate equivalent resources to BHP's portfolio.",
      url: "#", verdict: "BUY", confidence: 0.80, classifiedAt: new Date().toISOString(),
    },
    {
      ticker: "BHP", source: "newsapi", datetime: h(46),
      headline: "Australia tightens critical minerals export controls — BHP lithium shipments to China face new scrutiny",
      summary: "Canberra announced export licensing requirements for lithium, cobalt, and rare earths targeting Chinese buyers.",
      url: "#", verdict: "HOLD", confidence: 0.62, classifiedAt: new Date().toISOString(),
    },
  ],
};
