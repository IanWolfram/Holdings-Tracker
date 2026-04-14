/**
 * Run the Stock Analyzer agent against all mock news verdicts.
 * Usage:
 *   npx tsx scripts/review-verdicts.ts          # print to terminal
 *   npx tsx scripts/review-verdicts.ts --save   # also write lib/mock-verdicts.json
 */

import fs from "fs";
import path from "path";
import { classifyNews } from "../lib/classifier";
import { MOCK_NEWS } from "../lib/mock-news";
import type { ClassifiedStory } from "../types/news.types";

const SAVE = process.argv.includes("--save");

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";

const VERDICT_COLOR: Record<string, string> = {
  BUY: GREEN, SELL: RED, HOLD: YELLOW,
};

function bar(confidence: number, width = 20): string {
  const filled = Math.round(confidence * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

async function main() {
  console.log(`\n${BOLD}Stock Analyzer — Verdict Review${RESET}`);
  console.log(`Model: ${process.env.OLLAMA_MODEL ?? "gemma4-aggro"}\n`);

  const output: Record<string, ClassifiedStory[]> = {};

  for (const [ticker, stories] of Object.entries(MOCK_NEWS)) {
    console.log(`${BOLD}${CYAN}── ${ticker} ──────────────────────────────${RESET}`);
    output[ticker] = [];

    for (const story of stories) {
      const prev = story.verdict;
      const result = await classifyNews(story.ticker ?? ticker, story.headline, story.summary ?? "");
      const changed = result.verdict !== prev;

      const vc = VERDICT_COLOR[result.verdict] ?? RESET;
      const pvc = VERDICT_COLOR[prev] ?? RESET;
      const pct = Math.round(result.confidence * 100);

      console.log(`\n  ${DIM}${story.headline.slice(0, 72)}${RESET}`);
      console.log(`  ${vc}${BOLD}${result.verdict}${RESET}  ${bar(result.confidence)} ${pct}%`);

      if (changed) {
        console.log(`  ${YELLOW}⚡ changed from ${pvc}${prev}${RESET}${YELLOW} → ${vc}${result.verdict}${RESET}`);
      }

      if (result.reason) {
        console.log(`  ${DIM}"${result.reason}"${RESET}`);
      }

      output[ticker].push({
        ...story,
        verdict: result.verdict,
        confidence: result.confidence,
        reason: result.reason,
        classifiedAt: result.classifiedAt,
      });
    }

    console.log();
  }

  if (SAVE) {
    const outPath = path.join(process.cwd(), "lib", "mock-verdicts.json");
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`${BOLD}${GREEN}✓ Saved to lib/mock-verdicts.json${RESET}\n`);
  } else {
    console.log(`${DIM}Tip: run with --save to write lib/mock-verdicts.json${RESET}\n`);
  }
}

main().catch(console.error);
