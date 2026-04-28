import type { CatalystType } from "./predictions";

export interface CompanyProfile {
  ticker: string;
  name: string;
  country: string;       // Finnhub full name e.g. "United States"
  countryCode: string;   // ISO alpha-2 e.g. "US"
  sector: string;        // e.g. "Technology"
  industry: string;      // e.g. "Semiconductors"
  lat: number;
  lon: number;
}

export interface GeoStory {
  ticker: string;
  headline: string;
  summary: string;
  url: string;
  datetime: number;
  verdict: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reason?: string;
  source: string;
  originCountryCode?: string;  // ISO alpha-2 of news geo-origin
  relevanceScore: number;      // 0-1, world-brain confidence
  isAnalyzed?: boolean;        // Hardware-native M5 verified status
  catalystTypes?: CatalystType[];
}

export interface CountryState {
  countryCode: string;
  netVerdict: "BUY" | "SELL" | "HOLD" | null;
  netScore: number;            // -1 to +1
  stories: GeoStory[];
  isHQCountry: boolean;
  hqTickers: string[];
  totalPositionValue: number;
}

export interface WorldData {
  countries: Record<string, CountryState>; // keyed by ISO alpha-2
  profiles: Record<string, CompanyProfile>; // keyed by ticker
  fetchedAt: number;
}
