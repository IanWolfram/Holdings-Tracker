/**
 * Static map of Finnhub country names → { lat, lon, code }
 * Keys must match exactly what Finnhub's /stock/profile2 returns for `country`.
 */
export const COUNTRY_COORDS: Record<string, { lat: number; lon: number; code: string }> = {
  "United States": { lat: 37.09, lon: -95.71, code: "US" },
  "China": { lat: 35.86, lon: 104.19, code: "CN" },
  "Taiwan": { lat: 23.69, lon: 120.96, code: "TW" },
  "South Korea": { lat: 35.91, lon: 127.77, code: "KR" },
  "Japan": { lat: 36.20, lon: 138.25, code: "JP" },
  "Germany": { lat: 51.16, lon: 10.45, code: "DE" },
  "Netherlands": { lat: 52.13, lon: 5.29, code: "NL" },
  "France": { lat: 46.22, lon: 2.21, code: "FR" },
  "United Kingdom": { lat: 55.37, lon: -3.43, code: "GB" },
  "Israel": { lat: 31.04, lon: 34.85, code: "IL" },
  "Canada": { lat: 56.13, lon: -106.34, code: "CA" },
  "Australia": { lat: -25.27, lon: 133.77, code: "AU" },
  "India": { lat: 20.59, lon: 78.96, code: "IN" },
  "Switzerland": { lat: 46.81, lon: 8.22, code: "CH" },
  "Sweden": { lat: 60.12, lon: 18.64, code: "SE" },
  "Denmark": { lat: 56.26, lon: 9.50, code: "DK" },
  "Norway": { lat: 60.47, lon: 8.47, code: "NO" },
  "Finland": { lat: 61.92, lon: 25.75, code: "FI" },
  "Belgium": { lat: 50.50, lon: 4.47, code: "BE" },
  "Spain": { lat: 40.46, lon: -3.74, code: "ES" },
  "Italy": { lat: 41.87, lon: 12.56, code: "IT" },
  "Ireland": { lat: 53.41, lon: -8.24, code: "IE" },
  "Singapore": { lat: 1.35, lon: 103.82, code: "SG" },
  "Hong Kong": { lat: 22.32, lon: 114.17, code: "HK" },
  "Brazil": { lat: -14.23, lon: -51.92, code: "BR" },
  "Mexico": { lat: 23.63, lon: -102.55, code: "MX" },
  "Russia": { lat: 61.52, lon: 105.31, code: "RU" },
  "Saudi Arabia": { lat: 23.88, lon: 45.07, code: "SA" },
  "United Arab Emirates": { lat: 23.42, lon: 53.84, code: "AE" },
  "South Africa": { lat: -30.56, lon: 22.94, code: "ZA" },
  "New Zealand": { lat: -40.90, lon: 174.88, code: "NZ" },
  "Indonesia": { lat: -0.78, lon: 113.92, code: "ID" },
  "Malaysia": { lat: 4.21, lon: 101.97, code: "MY" },
  "Thailand": { lat: 15.87, lon: 100.99, code: "TH" },
  "Vietnam": { lat: 14.05, lon: 108.28, code: "VN" },
  "Philippines": { lat: 12.88, lon: 121.77, code: "PH" },
  "Portugal": { lat: 39.40, lon: -8.22, code: "PT" },
  "Austria": { lat: 47.52, lon: 14.55, code: "AT" },
  "Luxembourg": { lat: 49.82, lon: 6.13, code: "LU" },
  "Cyprus": { lat: 35.13, lon: 33.43, code: "CY" },
  "Cayman Islands": { lat: 19.31, lon: -81.25, code: "KY" },
  "Bermuda": { lat: 32.31, lon: -64.76, code: "BM" },
  "Panama": { lat: 8.54, lon: -80.78, code: "PA" },
};

/**
 * Look up country metadata by Finnhub country name.
 * Returns null if the country is not in the static map (non-critical failure).
 */
export function lookupCountry(
  name: string
): { lat: number; lon: number; code: string } | null {
  return COUNTRY_COORDS[name] ?? null;
}

/**
 * Look up country name by ISO alpha-2 code.
 */
export function lookupCountryByCode(code: string): string | null {
  const entry = Object.entries(COUNTRY_COORDS).find(([, v]) => v.code === code);
  return entry ? entry[0] : null;
}
