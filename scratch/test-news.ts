import { getServices } from "./src/registry";

async function test() {
  try {
    const { newsService } = getServices();
    const ticker = "JPM";
    const stories = await newsService.getNewsForTicker(ticker);
    console.log(`Success! Found ${stories.length} stories for ${ticker}`);
    for (const s of stories) {
      if (!s.isAnalyzed && s.confidence === 0) {
        console.log(`PENDING: ${s.headline}`);
      }
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
