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

  const mockData = {
    fetchedAt: Date.now(),
    profiles: {
      "BR": { name: "Broadridge Financial", ticker: "BR", countryCode: "US", lat: 40.71, lon: -74.00 },
      "MSFT": { name: "Microsoft Corporation", ticker: "MSFT", countryCode: "US", lat: 47.60, lon: -122.33 },
      "GLD": { name: "SPDR Gold Shares", ticker: "GLD", countryCode: "CH", lat: 47.37, lon: 8.54 },
      "RBL": { name: "Roblox Corporation", ticker: "RBL", countryCode: "JP", lat: 35.67, lon: 139.65 },
      "RPI": { name: "Royal Pharma Inc", ticker: "RPI", countryCode: "DE", lat: 52.52, lon: 13.40 },
      "RXD": { name: "ProShares Health Care", ticker: "RXD", countryCode: "GB", lat: 51.50, lon: -0.12 }
    },
    countries: {
      "US": {
        countryCode: "US", netVerdict: "BUY", netScore: 0.8, isHQCountry: true, hqTickers: ["MSFT", "BR"], totalPositionValue: 5208.25,
        stories: [
          { ticker: "MSFT", headline: "Copilot for Microsoft 365 reaches 1 million paid seats", summary: "Fastest enterprise adoption in company history.", url: "#", datetime: 1776106499000, verdict: "BUY", confidence: 0.9, source: "twitter", relevanceScore: 0.9, originCountryCode: "US" },
          { ticker: "BR", headline: "Broadridge Financial beats Q3 earnings estimates", summary: "Broadridge reported EPS of $1.84 vs $1.71 expected.", url: "#", datetime: 1776117299000, verdict: "BUY", confidence: 0.9, source: "finnhub", relevanceScore: 0.9, originCountryCode: "US" },
          { ticker: "RXD", headline: "Healthcare sector underperforms broad market", summary: "The XLV ETF dropped 2.3% this week.", url: "#", datetime: 1776113699000, verdict: "SELL", confidence: 0.6, source: "finnhub", relevanceScore: 0.6, originCountryCode: "US" }
        ]
      },
      "CH": {
        countryCode: "CH", netVerdict: "BUY", netScore: 0.9, isHQCountry: true, hqTickers: ["GLD"], totalPositionValue: 467.04,
        stories: [
          { ticker: "GLD", headline: "Central banks globally added 290 tonnes of gold in Q1", summary: "Strongest quarter in decades.", url: "#", datetime: 1776102899000, verdict: "BUY", confidence: 0.9, source: "twitter", relevanceScore: 0.9, originCountryCode: "CH" }
        ]
      },
      "JP": {
        countryCode: "JP", netVerdict: "BUY", netScore: 0.8, isHQCountry: true, hqTickers: ["RBL"], totalPositionValue: 1850.00,
        stories: [
          { ticker: "RBL", headline: "Roblox (RBL) daily active users grow 17% YoY", summary: "DAUs reached 88.9M with strong growth.", url: "#", datetime: 1776020099000, verdict: "BUY", confidence: 0.9, source: "finnhub", relevanceScore: 0.9, originCountryCode: "JP" }
        ]
      },
      "DE": {
        countryCode: "DE", netVerdict: "BUY", netScore: 0.75, isHQCountry: true, hqTickers: ["RPI"], totalPositionValue: 2860.00,
        stories: [
          { ticker: "RPI", headline: "Inflation data comes in cooler than expected at 3.1%", summary: "CPI rose 3.1% YoY in the latest reading.", url: "#", datetime: 1776099299000, verdict: "BUY", confidence: 0.9, source: "finnhub", relevanceScore: 0.9, originCountryCode: "DE" }
        ]
      },
      "GB": {
        countryCode: "GB", netVerdict: "SELL", netScore: -0.6, isHQCountry: true, hqTickers: ["RXD"], totalPositionValue: 331.00,
        stories: [
          { ticker: "RXD", headline: "Inverse healthcare ETFs see elevated volume", summary: "Pharma names sell off on Medicare news.", url: "#", datetime: 1776092099000, verdict: "SELL", confidence: 0.6, source: "twitter", relevanceScore: 0.6, originCountryCode: "GB" }
        ]
      },
      "CN": {
        countryCode: "CN", netVerdict: "SELL", netScore: -0.8, isHQCountry: false, hqTickers: [], totalPositionValue: 0,
        stories: [
          { ticker: "MSFT", headline: "Regulatory Concerns for Cloud in APAC", summary: "Tighter rules for foreign infrastructure providers.", url: "#", datetime: 1776041699000, verdict: "SELL", confidence: 0.8, source: "newsapi", relevanceScore: 0.8, originCountryCode: "CN" }
        ]
      },
      "AU": {
        countryCode: "AU", netVerdict: "SELL", netScore: -0.8, isHQCountry: false, hqTickers: [], totalPositionValue: 0,
        stories: [
          { ticker: "RBL", headline: "RBL misses Q2 revenue estimates by 8%", summary: "Cites softer-than-expected ad market.", url: "#", datetime: 1776077699000, verdict: "SELL", confidence: 0.88, source: "twitter", relevanceScore: 0.88, originCountryCode: "AU" }
        ]
      }
    }
  };

  res.status(200).json(mockData);
}
