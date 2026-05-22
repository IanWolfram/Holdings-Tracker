/**
 * Convert an ISO 3166-1 alpha-2 country code to its regional indicator emoji.
 * e.g. "US" -> "🇺🇸", "CN" -> "🇨🇳"
 */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join("");
}

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CN: "China",
  TW: "Taiwan",
  KR: "South Korea",
  JP: "Japan",
  DE: "Germany",
  NL: "Netherlands",
  FR: "France",
  GB: "United Kingdom",
  IL: "Israel",
  CA: "Canada",
  AU: "Australia",
  IN: "India",
  CH: "Switzerland",
  SE: "Sweden",
  DK: "Denmark",
  NO: "Norway",
  FI: "Finland",
  BE: "Belgium",
  ES: "Spain",
  IT: "Italy",
  IE: "Ireland",
  SG: "Singapore",
  HK: "Hong Kong",
  BR: "Brazil",
  MX: "Mexico",
  RU: "Russia",
  SA: "Saudi Arabia",
  AE: "UAE",
  ZA: "South Africa",
  NZ: "New Zealand",
  ID: "Indonesia",
  MY: "Malaysia",
  TH: "Thailand",
  VN: "Vietnam",
  PH: "Philippines",
  PT: "Portugal",
  AT: "Austria",
  LU: "Luxembourg",
};