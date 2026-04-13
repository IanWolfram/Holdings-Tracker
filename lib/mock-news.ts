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
};
