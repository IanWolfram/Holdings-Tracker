
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fetchFinnhubNews } from "../lib/finnhub";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const [k, ...rest] = line.split("=");
    if (k && !k.startsWith("#")) {
      process.env[k.trim()] = rest.join("=").trim();
    }
  }
}

async function main() {
  const tickers = ["CHKP", "MMS", "MDB", "HOOD", "PLTR"];
  for (const ticker of tickers) {
    console.log(`\n--- NEWS FOR ${ticker} ---`);
    try {
      const news = await fetchFinnhubNews(ticker);
      for (const item of news.slice(0, 5)) {
        console.log(`TITLE: ${item.headline}`);
        console.log(`SUMMARY: ${item.summary || "(no summary)"}`);
        console.log('---');
      }
    } catch (err) {
      console.error(`Failed for ${ticker}: ${(err as Error).message}`);
    }
  }
}

main();
