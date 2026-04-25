import type { Position } from "@/types/position.types";

export const MOCK_POSITIONS: Position[] = [
  { ticker: "BR",     description: "Broadridge Financial Solutions", quantity: 15,  marketValue: 3105.00,  gainLoss:  450.00, pricePaid: 177.00, currentPrice: 207.00, purchaseDate: new Date("2025-11-15").getTime() },
  { ticker: "MSFT",   description: "Microsoft Corporation",          quantity: 5,   marketValue: 2103.25,  gainLoss:  153.15, pricePaid: 390.00, currentPrice: 420.65, purchaseDate: new Date("2025-12-20").getTime() },
  { ticker: "AAPL",   description: "Apple Inc.",                     quantity: 10,  marketValue: 1956.00,  gainLoss:  256.00, pricePaid: 170.00, currentPrice: 195.60, purchaseDate: new Date("2026-01-10").getTime() },
  { ticker: "NVDA",   description: "NVIDIA Corporation",             quantity: 4,   marketValue: 3492.00,  gainLoss: 1092.00, pricePaid: 600.00, currentPrice: 873.00, purchaseDate: new Date("2026-02-03").getTime() },
  { ticker: "JPM",    description: "JPMorgan Chase & Co.",           quantity: 12,  marketValue: 2527.20,  gainLoss:  367.20, pricePaid: 180.00, currentPrice: 210.60, purchaseDate: new Date("2025-10-25").getTime() },
  { ticker: "RBL",    description: "Roblox Corporation",             quantity: 50,  marketValue: 1850.00,  gainLoss: -150.00, pricePaid:  40.00, currentPrice:  37.00, purchaseDate: new Date("2026-01-05").getTime() },
  { ticker: "TM",     description: "Toyota Motor Corporation",       quantity: 8,   marketValue: 1496.00,  gainLoss: -104.00, pricePaid: 200.00, currentPrice: 187.00, purchaseDate: new Date("2025-09-18").getTime() },
  { ticker: "INFY",   description: "Infosys Limited",                quantity: 60,  marketValue: 1122.00,  gainLoss:  162.00, pricePaid:  16.00, currentPrice:  18.70, purchaseDate: new Date("2025-11-30").getTime() },
  { ticker: "005930", description: "Samsung Electronics Co. Ltd",    quantity: 10,  marketValue:  620.00,  gainLoss:   20.00, pricePaid:  60.00, currentPrice:  62.00, purchaseDate: new Date("2026-03-01").getTime() },
];

export const WORLD_PROFILES: Record<string, { name: string; ticker: string; countryCode: string }> = {
  "BR":     { name: "Broadridge Financial Solutions", ticker: "BR",     countryCode: "US" },
  "MSFT":   { name: "Microsoft Corporation",          ticker: "MSFT",   countryCode: "US" },
  "AAPL":   { name: "Apple Inc.",                     ticker: "AAPL",   countryCode: "US" },
  "NVDA":   { name: "NVIDIA Corporation",             ticker: "NVDA",   countryCode: "US" },
  "JPM":    { name: "JPMorgan Chase & Co.",           ticker: "JPM",    countryCode: "US" },
  "RBL":    { name: "Roblox Corporation",             ticker: "RBL",    countryCode: "US" },
  "TM":     { name: "Toyota Motor Corporation",       ticker: "TM",     countryCode: "JP" },
  "INFY":   { name: "Infosys Limited",                ticker: "INFY",   countryCode: "IN" },
  "005930": { name: "Samsung Electronics Co. Ltd",    ticker: "005930", countryCode: "KR" },
};
