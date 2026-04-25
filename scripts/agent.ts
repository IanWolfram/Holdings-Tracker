/**
 * Pulse — Portfolio Intelligence Agent
 *
 * Runs the unified brain against every news article for all live positions,
 * passing the FULL holdings context so the model can reason about indirect
 * impacts across your entire portfolio (e.g. TSMC news → affects NVDA).
 *
 * Usage:
 *   npm run agent
 *
 * Requirements:
 *   - MLX server running locally (npm run start:mlx)
 *   - Live E*TRADE tokens (npm run etrade:auth if expired)
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { UnifiedAnalysis } from "../world-brain/brain";
import { runStockAgent } from "../lib/agent/service";

// Load .env.local synchronously before main() runs any lib code
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const [k, ...rest] = line.split("=");
    if (k && !k.startsWith("#") && !(k.trim() in process.env)) {
      process.env[k.trim()] = rest.join("=").trim();
    }
  }
}

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const R  = "\x1b[0m";
const B  = "\x1b[1m";
const D  = "\x1b[2m";
const G  = "\x1b[32m";
const RD = "\x1b[31m";
const Y  = "\x1b[33m";
const C  = "\x1b[36m";
const M  = "\x1b[35m";
const W  = "\x1b[37m";

const VERDICT_COLOR: Record<string, string> = { BUY: G, SELL: RD, HOLD: Y };

function bar(v: number, width = 22): string {
  const n = Math.round(Math.max(0, Math.min(1, v)) * width);
  return `${B}${"█".repeat(n)}${D}${"░".repeat(width - n)}${R}`;
}

function flag(code: string | null): string {
  if (!code || code.length !== 2) return "  ";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e0 + c.charCodeAt(0) - 65)
  );
}

function tags(arr: string[]): string {
  return arr.map((t: string) => `${D}[${t}]${R}`).join(" ");
}

function hr(char = "─", width = 60): string {
  return D + char.repeat(width) + R;
}

// ── Render a single story analysis ───────────────────────────────────────────

function renderStory(
  n: number,
  headline: string,
  analysis: UnifiedAnalysis,
  focalTicker: string
): void {
  const vc = VERDICT_COLOR[analysis.verdict] ?? W;
  const pct = Math.round(analysis.confidence * 100);
  const rel = Math.round(analysis.relevanceScore * 100);
  const geo = analysis.originCountryCode;
  const others = analysis.affectedTickers.filter((t) => t !== focalTicker);

  console.log(`\n  ${B}${n}.${R} ${headline}`);
  console.log(
    `     ${bar(analysis.confidence)}  ${vc}${B}${analysis.verdict}${R}  ${pct}%` +
    `  ${D}│${R}  ${flag(geo)} ${geo ?? "??"}  ${D}relevance ${rel}%${R}`
  );
  if (analysis.reason) {
    console.log(`     ${D}"${analysis.reason}"${R}`);
  }
  if (analysis.geoSummary) {
    console.log(`     ${D}↳ ${analysis.geoSummary}${R}`);
  }
  if (analysis.sectorTags.length > 0) {
    console.log(`     ${D}Sectors:${R} ${tags(analysis.sectorTags)}`);
  }
  if (others.length > 0) {
    console.log(`     ${D}Also affects:${R} ${M}${others.join("  ")}${R}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const model = process.env.MLX_MODEL ?? "mlx-community/DeepSeek-R1-Distill-Qwen-14B-4bit";

  console.log(`\n${B}${C}Pulse — Stock Agent${R}`);
  console.log(hr("═"));
  console.log(`${D}Engine: ${B}MLX (Native M5)${R}  ${D}│  Model: ${B}${model}${R}`);

  // Use the shared service for the heavy lifting
  // The service handles positions, profiles, news, and brain calls
  const result = await runStockAgent();

  for (const tr of result.tickerResults) {
    console.log(`\n${B}${C}── ${tr.ticker}${R}`);
    if (tr.verdicts.length === 0) {
      console.log(`  ${D}No recent news found.${R}`);
      continue;
    }

    tr.verdicts.forEach((v, i) => {
      renderStory(i + 1, v.headline, v.analysis, tr.ticker);
    });
  }

  // ── Portfolio summary ────────────────────────────────────────────────

  console.log(`\n${hr("═")}`);
  console.log(`${B}Portfolio Summary${R}`);
  console.log(hr("─"));

  const total = (result.totalBuys + result.totalSells + result.totalHolds) || 1;

  console.log(
    `${G}${B}BUY${R}  ${bar(result.totalBuys / total, 30)}  ${result.totalBuys}` +
    `\n${RD}${B}SELL${R} ${bar(result.totalSells / total, 30)}  ${result.totalSells}` +
    `\n${Y}${B}HOLD${R} ${bar(result.totalHolds / total, 30)}  ${result.totalHolds}`
  );

  const overall = result.totalBuys > result.totalSells ? "BUY" : result.totalSells > result.totalBuys ? "SELL" : "HOLD";
  console.log(`\n${B}Overall signal:${R}  ${VERDICT_COLOR[overall]}${B}${overall}${R}`);
  console.log(hr("═") + "\n");
}

main().catch((err) => {
  console.error(`\n${RD}${B}Fatal error:${R}`, err);
  process.exit(1);
});
