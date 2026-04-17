import type { NextApiRequest, NextApiResponse } from "next";

interface WorldMockResponse {
  fetchedAt: number;
  profiles: Record<string, unknown>;
  countries: Record<string, unknown>;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorldMockResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const t = Date.now();
  const h = (n: number) => t - n * 3600000;

  const mockData = {
    fetchedAt: t,
    profiles: {
      "BR":     { name: "Broadridge Financial Solutions",   ticker: "BR",     countryCode: "US", lat: 40.71,   lon: -74.00  },
      "MSFT":   { name: "Microsoft Corporation",            ticker: "MSFT",   countryCode: "US", lat: 47.60,   lon: -122.33 },
      "GLD":    { name: "SPDR Gold Shares",                 ticker: "GLD",    countryCode: "CH", lat: 47.37,   lon:   8.54  },
      "RBL":    { name: "Roblox Corporation",               ticker: "RBL",    countryCode: "JP", lat: 35.67,   lon: 139.65  },
      "RPI":    { name: "Royal Pharma Inc",                 ticker: "RPI",    countryCode: "DE", lat: 52.52,   lon:  13.40  },
      "RXD":    { name: "ProShares UltraShort Health Care", ticker: "RXD",    countryCode: "GB", lat: 51.50,   lon:  -0.12  },
      "ITUB":   { name: "Itaú Unibanco Holding S.A.",       ticker: "ITUB",   countryCode: "BR", lat: -23.55,  lon: -46.63  },
      "TM":     { name: "Toyota Motor Corporation",         ticker: "TM",     countryCode: "JP", lat: 35.08,   lon: 137.15  },
      "INFY":   { name: "Infosys Limited",                  ticker: "INFY",   countryCode: "IN", lat: 12.97,   lon:  77.59  },
      "LVMH":   { name: "LVMH Moët Hennessy Louis Vuitton", ticker: "LVMH",   countryCode: "FR", lat: 48.86,   lon:   2.35  },
      "005930": { name: "Samsung Electronics Co. Ltd",      ticker: "005930", countryCode: "KR", lat: 37.56,   lon: 126.97  },
      "CNQ":    { name: "Canadian Natural Resources",       ticker: "CNQ",    countryCode: "CA", lat: 51.05,   lon: -114.07 },
      "BHP":    { name: "BHP Group Limited",                ticker: "BHP",    countryCode: "AU", lat: -37.81,  lon: 144.96  },
    },
    countries: {
      "US": {
        countryCode: "US", netVerdict: "BUY", netScore: 0.8, isHQCountry: true, hqTickers: ["MSFT", "BR"], totalPositionValue: 5208.25,
        stories: [
          { ticker: "MSFT", headline: "Copilot for Microsoft 365 reaches 1 million paid seats", summary: "Fastest enterprise adoption in company history.", url: "#", datetime: h(1), verdict: "BUY", confidence: 0.9, source: "twitter", relevanceScore: 0.9, originCountryCode: "US" },
          { ticker: "BR",   headline: "Broadridge Financial beats Q3 earnings estimates", summary: "Broadridge reported EPS of $1.84 vs $1.71 expected.", url: "#", datetime: h(2), verdict: "BUY", confidence: 0.9, source: "finnhub", relevanceScore: 0.9, originCountryCode: "US" },
          { ticker: "RXD",  headline: "Healthcare sector underperforms broad market", summary: "The XLV ETF dropped 2.3% this week.", url: "#", datetime: h(3), verdict: "SELL", confidence: 0.6, source: "finnhub", relevanceScore: 0.6, originCountryCode: "US" }
        ]
      },
      "CH": {
        countryCode: "CH", netVerdict: "BUY", netScore: 0.9, isHQCountry: true, hqTickers: ["GLD"], totalPositionValue: 467.04,
        stories: [
          { ticker: "GLD", headline: "Central banks globally added 290 tonnes of gold in Q1", summary: "Strongest quarter in decades.", url: "#", datetime: h(2), verdict: "BUY", confidence: 0.9, source: "twitter", relevanceScore: 0.9, originCountryCode: "CH" },
          { ticker: "GLD", headline: "Gold hits record high as central bank demand accelerates", summary: "Spot gold touched $2,380/oz on Monday.", url: "#", datetime: h(15), verdict: "BUY", confidence: 0.90, source: "newsapi", relevanceScore: 0.9, originCountryCode: "CH" }
        ]
      },
      "JP": {
        countryCode: "JP", netVerdict: "BUY", netScore: 0.72, isHQCountry: true, hqTickers: ["RBL", "TM"], totalPositionValue: 3346.00,
        stories: [
          { ticker: "TM",  headline: "Toyota posts strongest quarterly profit in five years on hybrid demand surge", summary: "Operating profit rose 28% to ¥1.1T.", url: "#", datetime: h(3), verdict: "BUY", confidence: 0.86, source: "finnhub", relevanceScore: 0.86, originCountryCode: "JP" },
          { ticker: "TM",  headline: "Yen weakness boosts Toyota's export earnings", summary: "FX tailwind estimated at ¥400B for FY2026.", url: "#", datetime: h(20), verdict: "BUY", confidence: 0.80, source: "finnhub", relevanceScore: 0.80, originCountryCode: "JP" },
          { ticker: "RBL", headline: "Roblox daily active users grow 17% YoY", summary: "DAUs reached 88.9M with strong growth.", url: "#", datetime: h(28), verdict: "BUY", confidence: 0.79, source: "finnhub", relevanceScore: 0.79, originCountryCode: "JP" }
        ]
      },
      "DE": {
        countryCode: "DE", netVerdict: "BUY", netScore: 0.75, isHQCountry: true, hqTickers: ["RPI"], totalPositionValue: 2860.00,
        stories: [
          { ticker: "RPI",  headline: "Inflation data comes in cooler than expected at 3.1%", summary: "CPI rose 3.1% YoY in the latest reading.", url: "#", datetime: h(6), verdict: "BUY", confidence: 0.9, source: "finnhub", relevanceScore: 0.9, originCountryCode: "DE" },
          { ticker: "LVMH", headline: "Euro strength erodes LVMH USD-reported margins", summary: "A 5% EUR/USD move reduces operating income by ~€380M.", url: "#", datetime: h(52), verdict: "SELL", confidence: 0.67, source: "newsapi", relevanceScore: 0.67, originCountryCode: "DE" }
        ]
      },
      "GB": {
        countryCode: "GB", netVerdict: "SELL", netScore: -0.6, isHQCountry: true, hqTickers: ["RXD"], totalPositionValue: 331.00,
        stories: [
          { ticker: "RXD", headline: "Inverse healthcare ETFs see elevated volume", summary: "Pharma names sell off on Medicare news.", url: "#", datetime: h(8), verdict: "SELL", confidence: 0.6, source: "twitter", relevanceScore: 0.6, originCountryCode: "GB" }
        ]
      },
      "BR": {
        countryCode: "BR", netVerdict: "BUY", netScore: 0.68, isHQCountry: true, hqTickers: ["ITUB"], totalPositionValue: 1240.00,
        stories: [
          { ticker: "ITUB", headline: "Itaú Unibanco reports record net income of R$10.1B in Q1 2026", summary: "Brazil's largest private bank beat estimates on strong loan growth.", url: "#", datetime: h(2), verdict: "BUY", confidence: 0.88, source: "finnhub", relevanceScore: 0.88, originCountryCode: "BR" },
          { ticker: "ITUB", headline: "Brazil Selic rate held at 13.75% — positive for bank margins", summary: "High rates sustain net interest income for Brazilian banks.", url: "#", datetime: h(9), verdict: "BUY", confidence: 0.79, source: "twitter", relevanceScore: 0.79, originCountryCode: "BR" },
          { ticker: "ITUB", headline: "Brazilian real weakens 4% against USD on fiscal deficit concerns", summary: "Currency headwinds could weigh on USD-denominated ADR returns.", url: "#", datetime: h(26), verdict: "SELL", confidence: 0.71, source: "finnhub", relevanceScore: 0.71, originCountryCode: "BR" }
        ]
      },
      "IN": {
        countryCode: "IN", netVerdict: "BUY", netScore: 0.78, isHQCountry: true, hqTickers: ["INFY"], totalPositionValue: 1122.00,
        stories: [
          { ticker: "INFY", headline: "Infosys raises FY2026 revenue guidance to 8-10% on AI deal flow", summary: "Enterprise AI adoption cited as primary demand driver.", url: "#", datetime: h(1), verdict: "BUY", confidence: 0.91, source: "finnhub", relevanceScore: 0.91, originCountryCode: "IN" },
          { ticker: "INFY", headline: "Infosys wins $2.1B digital transformation contract with European financial consortium", summary: "Multi-year deal bolsters order book visibility.", url: "#", datetime: h(7), verdict: "BUY", confidence: 0.87, source: "twitter", relevanceScore: 0.87, originCountryCode: "IN" },
          { ticker: "INFY", headline: "US H-1B visa scrutiny intensifies — Indian IT firms face higher costs", summary: "Proposed reforms could add $150-200M in annual US delivery costs.", url: "#", datetime: h(19), verdict: "SELL", confidence: 0.65, source: "finnhub", relevanceScore: 0.65, originCountryCode: "IN" }
        ]
      },
      "FR": {
        countryCode: "FR", netVerdict: "SELL", netScore: -0.22, isHQCountry: true, hqTickers: ["LVMH"], totalPositionValue: 2001.00,
        stories: [
          { ticker: "LVMH", headline: "LVMH Q1 revenue grows 6% organically, Fashion & Leather leads", summary: "Louis Vuitton and Dior drove outperformance.", url: "#", datetime: h(4), verdict: "BUY", confidence: 0.83, source: "finnhub", relevanceScore: 0.83, originCountryCode: "FR" },
          { ticker: "LVMH", headline: "Chinese luxury spending down 12% YoY in March", summary: "LVMH China exposure at 26% of revenue.", url: "#", datetime: h(14), verdict: "SELL", confidence: 0.74, source: "twitter", relevanceScore: 0.74, originCountryCode: "FR" },
          { ticker: "LVMH", headline: "Euro strength vs dollar erodes LVMH's USD-reported margins", summary: "EUR/USD appreciation reduces translated USD operating income.", url: "#", datetime: h(52), verdict: "SELL", confidence: 0.67, source: "newsapi", relevanceScore: 0.67, originCountryCode: "FR" }
        ]
      },
      "KR": {
        countryCode: "KR", netVerdict: "BUY", netScore: 0.65, isHQCountry: true, hqTickers: ["005930"], totalPositionValue: 620.00,
        stories: [
          { ticker: "005930", headline: "Samsung swings to profit on DRAM price recovery and HBM3 improvements", summary: "DS division posted ₩3.8T operating profit as DRAM prices rose 22% QoQ.", url: "#", datetime: h(2), verdict: "BUY", confidence: 0.89, source: "finnhub", relevanceScore: 0.89, originCountryCode: "KR" },
          { ticker: "005930", headline: "Samsung wins $6.4B DRAM supply deal with US hyperscaler for AI infra", summary: "Multi-year HBM3E supply agreement for AI training clusters.", url: "#", datetime: h(24), verdict: "BUY", confidence: 0.85, source: "finnhub", relevanceScore: 0.85, originCountryCode: "KR" },
          { ticker: "005930", headline: "Samsung foundry losing ground to TSMC at 3nm — yield gap persists", summary: "Yield gap still 15-20pp behind TSMC at leading-edge nodes.", url: "#", datetime: h(10), verdict: "SELL", confidence: 0.72, source: "twitter", relevanceScore: 0.72, originCountryCode: "KR" }
        ]
      },
      "CA": {
        countryCode: "CA", netVerdict: "BUY", netScore: 0.60, isHQCountry: true, hqTickers: ["CNQ"], totalPositionValue: 924.00,
        stories: [
          { ticker: "CNQ", headline: "Canadian Natural Resources raises dividend 14% after record oil sands FCF", summary: "C$4.2B in free cash flow as Athabasca production hit 1.4M boe/d.", url: "#", datetime: h(5), verdict: "BUY", confidence: 0.84, source: "finnhub", relevanceScore: 0.84, originCountryCode: "CA" },
          { ticker: "CNQ", headline: "Trans Mountain pipeline expansion reaches full capacity", summary: "890,000 boe/d now flowing to Burnaby terminal, unlocking Asian premium pricing.", url: "#", datetime: h(36), verdict: "BUY", confidence: 0.78, source: "finnhub", relevanceScore: 0.78, originCountryCode: "CA" },
          { ticker: "CNQ", headline: "WTI crude falls below $75 — Canadian heavy oil differentials widen", summary: "Energy demand concerns pressure oil sands producers.", url: "#", datetime: h(15), verdict: "SELL", confidence: 0.70, source: "twitter", relevanceScore: 0.70, originCountryCode: "CA" }
        ]
      },
      "AU": {
        countryCode: "AU", netVerdict: "BUY", netScore: 0.55, isHQCountry: true, hqTickers: ["BHP"], totalPositionValue: 1487.50,
        stories: [
          { ticker: "BHP", headline: "BHP reports record copper production, raises FY2026 guidance 8%", summary: "Escondida and Olympic Dam drove the beat.", url: "#", datetime: h(3), verdict: "BUY", confidence: 0.87, source: "finnhub", relevanceScore: 0.87, originCountryCode: "AU" },
          { ticker: "BHP", headline: "BHP acquires Chilean lithium junior for $890M", summary: "Atacama acquisition adds 2.1Mt of LCE resources.", url: "#", datetime: h(29), verdict: "BUY", confidence: 0.80, source: "finnhub", relevanceScore: 0.80, originCountryCode: "AU" },
          { ticker: "BHP", headline: "Iron ore price slides to $98/tonne on Chinese steel data miss", summary: "Three consecutive months of disappointing steel output.", url: "#", datetime: h(13), verdict: "SELL", confidence: 0.75, source: "twitter", relevanceScore: 0.75, originCountryCode: "AU" }
        ]
      },
      "CN": {
        countryCode: "CN", netVerdict: "SELL", netScore: -0.8, isHQCountry: false, hqTickers: [], totalPositionValue: 0,
        stories: [
          { ticker: "MSFT",   headline: "Regulatory concerns for cloud infrastructure in APAC", summary: "Tighter rules for foreign infrastructure providers.", url: "#", datetime: h(41), verdict: "SELL", confidence: 0.8, source: "newsapi", relevanceScore: 0.8, originCountryCode: "CN" },
          { ticker: "005930", headline: "Samsung foundry cedes 3nm leadership to TSMC", summary: "Chinese foundry rivals also gaining on legacy nodes.", url: "#", datetime: h(10), verdict: "SELL", confidence: 0.72, source: "twitter", relevanceScore: 0.72, originCountryCode: "CN" },
          { ticker: "LVMH",   headline: "Chinese luxury spending down 12% YoY in March", summary: "LVMH China revenue at risk heading into Q2.", url: "#", datetime: h(14), verdict: "SELL", confidence: 0.74, source: "twitter", relevanceScore: 0.74, originCountryCode: "CN" }
        ]
      }
    }
  };

  res.status(200).json(mockData);
}
