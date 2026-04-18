import { CITY_COORDS } from "./city-coords";
import { lookupCountry } from "./country-coords";

/**
 * Normalizes a city and state/country pair to match the CITY_COORDS keys.
 * Handles "City, State" (US) and "City, Country" (International) normalization.
 */
function normalizeKey(city: string, province?: string): string {
  const c = city.trim();
  const p = province?.trim();
  if (!p) return c;

  // For US/Canada, we usually use 2-letter codes or full names
  // For international, we use the country name
  return `${c}, ${p}`;
}

/**
 * Resolves a company location to geographic coordinates.
 * 
 * @param city - The city name (e.g., "Cupertino")
 * @param province - The state/region/country code (e.g., "CA", "Ontario", "UK")
 * @param country - The full country name (e.g., "United States")
 * @returns { lat: number, lon: number }
 */
export function resolveCoordinates(
  city?: string,
  province?: string,
  country?: string
): { lat: number; lon: number } | null {
  if (!city && !country) return null;

  // 1. Try specific city-level lookup
  if (city) {
    const primaryKey = normalizeKey(city, province);
    if (CITY_COORDS[primaryKey]) return CITY_COORDS[primaryKey];

    // Try just city if province didn't match
    if (CITY_COORDS[city]) return CITY_COORDS[city];

    // Fuzzy match: check if the city name exists anywhere in the keys
    const entries = Object.entries(CITY_COORDS);
    const fuzzyMatch = entries.find(([k]) => k.toLowerCase().startsWith(city.toLowerCase()));
    if (fuzzyMatch) return fuzzyMatch[1];
  }

  // 2. Fallback to country-level centroid
  if (country) {
    const countryData = lookupCountry(country);
    if (countryData) return { lat: countryData.lat, lon: countryData.lon };
  }

  return null;
}
