import type { NextApiRequest, NextApiResponse } from "next";
import type { WorldData } from "@/types/geo.types";
import { WORLD_PROFILES, MOCK_POSITIONS } from "@/lib/position-list";
import { lookupCountryByCode } from "@/lib/country-coords";
import { getWorldData } from "@/lib/world-data";
import { getServices } from "@/src/registry";
import { fetchCompanyProfile } from "@/lib/company-profile";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorldData | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (process.env.ETRADE_ENV !== "mock") {
    try {
      const { portfolioService } = getServices();
      const { positions, mock } = await portfolioService.getPositionsSafe();
      const data = await getWorldData(positions, { mock });
      return res.status(200).json(data);
    } catch (err) {
      console.error("[/api/world] Live data failed, falling back to mock:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Mock data — used when ETRADE_ENV=mock or live path failed
  // ---------------------------------------------------------------------------

  const t = Date.now();
  const h = (n: number) => t - n * 3600000;

  // Build country buckets dynamically so they stay in sync with WORLD_PROFILES / MOCK_POSITIONS
  const mockCountries: WorldData["countries"] = {};
  for (const [ticker, wp] of Object.entries(WORLD_PROFILES)) {
    const code = wp.countryCode;
    const pos = MOCK_POSITIONS.find((p) => p.ticker === ticker);
    if (!mockCountries[code]) {
      mockCountries[code] = {
        countryCode: code,
        netVerdict: "BUY",
        netScore: 0.75,
        isHQCountry: true,
        hqTickers: [],
        totalPositionValue: 0,
        stories: [],
      };
    }
    if (!mockCountries[code].hqTickers.includes(ticker)) {
      mockCountries[code].hqTickers.push(ticker);
    }
    mockCountries[code].totalPositionValue += pos?.marketValue ?? 0;
  }

  // Static story overlays — merged onto the dynamic country buckets
  type StoryOverlay = Pick<WorldData["countries"][string], "netVerdict" | "netScore" | "stories">;
  const storyOverlays: Record<string, StoryOverlay> = {
    "US": {
      netVerdict: "BUY", netScore: 0.78,
      stories: [
        { ticker: "MSFT", headline: "Copilot for Microsoft 365 reaches 1 million paid seats", summary: "Fastest enterprise adoption in company history.", url: "#", datetime: h(1), verdict: "BUY", confidence: 0.89, source: "polygon", relevanceScore: 0.89, originCountryCode: "US" },
        { ticker: "NVDA", headline: "NVIDIA Blackwell GPU shipments exceed 400,000 units in Q1", summary: "Data center revenue surged 78% YoY to $22.6B.", url: "#", datetime: h(2), verdict: "BUY", confidence: 0.95, source: "finnhub", relevanceScore: 0.95, originCountryCode: "US" },
        { ticker: "AAPL", headline: "Apple Services revenue hits all-time high of $26.9B", summary: "App Store, iCloud, and Apple TV+ drove 74% gross margin.", url: "#", datetime: h(3), verdict: "BUY", confidence: 0.90, source: "newsapi", relevanceScore: 0.90, originCountryCode: "US" },
        { ticker: "JPM",  headline: "JPMorgan Q1 profit jumps 9% to $14.6B, investment banking surges 45%", summary: "M&A advisory and equity underwriting drove the beat.", url: "#", datetime: h(5), verdict: "BUY", confidence: 0.86, source: "finnhub", relevanceScore: 0.86, originCountryCode: "US" },
        { ticker: "BR",   headline: "Broadridge Financial beats Q3 earnings estimates", summary: "Broadridge reported EPS of $1.84 vs $1.71 expected.", url: "#", datetime: h(6), verdict: "BUY", confidence: 0.91, source: "finnhub", relevanceScore: 0.91, originCountryCode: "US" },
        { ticker: "NVDA", headline: "US export controls tighten on advanced AI chips to China", summary: "NVIDIA estimates $5.5B revenue impact from Commerce Dept rule.", url: "#", datetime: h(14), verdict: "SELL", confidence: 0.78, source: "finnhub", relevanceScore: 0.78, originCountryCode: "US" },
      ],
    },
    "JP": {
      netVerdict: "BUY", netScore: 0.72,
      stories: [
        { ticker: "TM",  headline: "Toyota posts strongest quarterly profit in five years on hybrid demand surge", summary: "Operating profit rose 28% to ¥1.1T.", url: "#", datetime: h(3), verdict: "BUY", confidence: 0.86, source: "finnhub", relevanceScore: 0.86, originCountryCode: "JP" },
        { ticker: "TM",  headline: "Yen weakness boosts Toyota's export earnings", summary: "FX tailwind estimated at ¥400B for FY2026.", url: "#", datetime: h(20), verdict: "BUY", confidence: 0.80, source: "finnhub", relevanceScore: 0.80, originCountryCode: "JP" },
        { ticker: "RBL", headline: "Roblox daily active users grow 17% YoY", summary: "DAUs reached 88.9M with strong growth.", url: "#", datetime: h(28), verdict: "BUY", confidence: 0.79, source: "finnhub", relevanceScore: 0.79, originCountryCode: "JP" },
      ],
    },
    "IN": {
      netVerdict: "BUY", netScore: 0.78,
      stories: [
        { ticker: "INFY", headline: "Infosys raises FY2026 revenue guidance to 8-10% on AI deal flow", summary: "Enterprise AI adoption cited as primary demand driver.", url: "#", datetime: h(1), verdict: "BUY", confidence: 0.91, source: "finnhub", relevanceScore: 0.91, originCountryCode: "IN" },
        { ticker: "INFY", headline: "Infosys wins $2.1B digital transformation contract with European financial consortium", summary: "Multi-year deal bolsters order book visibility.", url: "#", datetime: h(7), verdict: "BUY", confidence: 0.87, source: "polygon", relevanceScore: 0.87, originCountryCode: "IN" },
        { ticker: "INFY", headline: "US H-1B visa scrutiny intensifies — Indian IT firms face higher costs", summary: "Proposed reforms could add $150-200M in annual US delivery costs.", url: "#", datetime: h(19), verdict: "SELL", confidence: 0.65, source: "finnhub", relevanceScore: 0.65, originCountryCode: "IN" },
      ],
    },
    "KR": {
      netVerdict: "BUY", netScore: 0.65,
      stories: [
        { ticker: "005930", headline: "Samsung swings to profit on DRAM price recovery and HBM3 improvements", summary: "DS division posted ₩3.8T operating profit as DRAM prices rose 22% QoQ.", url: "#", datetime: h(2), verdict: "BUY", confidence: 0.89, source: "finnhub", relevanceScore: 0.89, originCountryCode: "KR" },
        { ticker: "005930", headline: "Samsung wins $6.4B DRAM supply deal with US hyperscaler for AI infra", summary: "Multi-year HBM3E supply agreement for AI training clusters.", url: "#", datetime: h(24), verdict: "BUY", confidence: 0.85, source: "finnhub", relevanceScore: 0.85, originCountryCode: "KR" },
        { ticker: "005930", headline: "Samsung foundry losing ground to TSMC at 3nm — yield gap persists", summary: "Yield gap still 15-20pp behind TSMC at leading-edge nodes.", url: "#", datetime: h(10), verdict: "SELL", confidence: 0.72, source: "polygon", relevanceScore: 0.72, originCountryCode: "KR" },
      ],
    },
    "CN": {
      netVerdict: "SELL", netScore: -0.8,
      stories: [
        { ticker: "MSFT",   headline: "Regulatory concerns for cloud infrastructure in APAC", summary: "Tighter rules for foreign infrastructure providers.", url: "#", datetime: h(41), verdict: "SELL", confidence: 0.8, source: "newsapi", relevanceScore: 0.8, originCountryCode: "CN" },
        { ticker: "005930", headline: "Samsung foundry cedes 3nm leadership to TSMC", summary: "Chinese foundry rivals also gaining on legacy nodes.", url: "#", datetime: h(10), verdict: "SELL", confidence: 0.72, source: "polygon", relevanceScore: 0.72, originCountryCode: "CN" },
      ],
    },
  };

  for (const [code, overlay] of Object.entries(storyOverlays)) {
    if (mockCountries[code]) {
      Object.assign(mockCountries[code], overlay);
    } else {
      mockCountries[code] = {
        countryCode: code,
        isHQCountry: false,
        hqTickers: [],
        totalPositionValue: 0,
        ...overlay,
      };
    }
  }

  const profilesList = await Promise.all(
    Object.keys(WORLD_PROFILES).map(async (ticker) => {
      const prof = await fetchCompanyProfile(ticker);
      return prof ? [ticker, prof] : null;
    })
  );

  const mockData: WorldData = {
    fetchedAt: t,
    profiles: Object.fromEntries(profilesList.filter(Boolean) as [string, any][]),
    countries: mockCountries,
  };

  res.status(200).json(mockData);
}
