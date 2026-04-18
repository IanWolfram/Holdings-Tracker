import { fetchCompanyProfile } from "./lib/company-profile";

async function verify() {
  const tickers = ["HOOD", "COIN", "PLTR", "RBL", "MSTR"];
  console.log("Verifying coordinate lookups...");
  for (const ticker of tickers) {
    const profile = await fetchCompanyProfile(ticker);
    if (profile) {
      console.log(`${ticker}: ${profile.lat}, ${profile.lon} (${profile.country})`);
    } else {
      console.log(`${ticker}: Profile not found`);
    }
  }
}

verify();
