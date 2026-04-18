/**
 * Test script to verify the automated stock location fetching logic.
 * This script mocks the Polygon.io API response to test the coordinate resolution.
 */

import { fetchCompanyProfile } from "../lib/company-profile";

// Mocking the global fetch for testing
const originalFetch = global.fetch;

async function testGeoAutomation() {
  console.log("--- Testing Geo Automation System ---\n");

  const testTickers = [
    { ticker: "SHOP", city: "Ottawa", state: "Ontario", country: "Canada" },
    { ticker: "SPOT", city: "Stockholm", state: "Stockholm", country: "Sweden" },
    { ticker: "MSTR", city: "Tysons", state: "VA", country: "United States" },
  ];

  for (const { ticker, city, state, country } of testTickers) {
    console.log(`Testing ticker: ${ticker}`);
    
    // Mock Polygon response
    global.fetch = async (url: string) => {
      if (url.includes("polygon.io")) {
        return {
          ok: true,
          json: async () => ({
            results: {
              ticker,
              address: { city, state }
            },
            status: "OK"
          })
        } as any;
      }
      return originalFetch(url);
    };

    // Need a dummy Polygon key for the logic to trigger
    process.env.POLYGON_API_KEY = "test_key";

    const profile = await fetchCompanyProfile(ticker);
    
    if (profile) {
      console.log(`   - Resolved Location: ${profile.lat}, ${profile.lon}`);
      console.log(`   - Source Info: ${city}, ${state} (${country})`);
      
      // Verify it's not the Kansas default if it's a US stock
      if (country === "United States" && profile.lat === 37.09 && profile.lon === -95.71) {
        console.error("   [ERROR] Failed to resolve to specific city, fell back to Kansas centroid.");
      } else {
        console.log("   [SUCCESS] Resolved to specific city coordinates.");
      }
    } else {
      console.error(`   [ERROR] Could not fetch profile for ${ticker}`);
    }
    console.log("");
  }

  // Restore global fetch
  global.fetch = originalFetch;
}

testGeoAutomation().catch(console.error);
