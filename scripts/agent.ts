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
 *   - OLLAMA_ENABLED=true in .env.local
 *   - gemma4-aggro pulled and running in Ollama
 *   - Live E*TRADE tokens (npm run etrade:auth if expired)
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { UnifiedAnalysis } from "../world-brain/brain";

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

async function main() {
  // Dynamic imports happen here — after env vars are set — so lazy
  // client inits (e.g. Finnhub SDK) pick up the correct API keys.
  const { getPositions }        = await import("../lib/etrade");
  const { fetchFinnhubNews }    = await import("../lib/finnhub");
  const { fetchCompanyProfile } = await import("../lib/company-profile");
  const { analyzeStory }        = await import("../world-brain/brain");

  const engine = process.env.AI_ENGINE ?? "ollama";
  const ollamaEnabled = process.env.OLLAMA_ENABLED === "true";
  const activeEngine = (engine === "mlx" || (engine === "ollama" && ollamaEnabled)) ? engine : "none";

  const model = engine === "mlx"
    ? (process.env.MLX_MODEL ?? "mlx-community/DeepSeek-R1-Distill-Qwen-14B-4bit")
    : (process.env.OLLAMA_MODEL ?? "gemma4-aggro");

  console.log(`\n${B}${C}Pulse — Portfolio Intelligence Agent${R}`);
  console.log(hr("═"));

  if (activeEngine === "none") {
    console.warn(
      `\n${Y}${B}⚠  No AI Engine enabled in .env.local.${R}\n` +
      `   Results will use keyword fallback — not the AI brain.\n` +
      `   Set AI_ENGINE=mlx or AI_ENGINE=ollama (with OLLAMA_ENABLED=true).\n`
    );
  } else {
    const engineLabel = activeEngine === "mlx" ? "MLX (Native M5)" : "Ollama (Local LLM)";
    console.log(`${D}Engine: ${B}${engineLabel}${R}  ${D}│  Model: ${B}${model}${R}`);
  }

  // ── 1. Fetch live positions ─────────────────────────────────────────────
  console.log(`\n${D}Fetching live positions…${R}`);
  const positions = await getPositions();
  console.log(`${B}${positions.length} positions loaded.${R}`);

  // ── 2. Fetch all company profiles sequentially (avoids Finnhub rate limits)
  console.log(`${D}Fetching company profiles…${R}\n`);
  const profiles: Record<string, Awaited<ReturnType<typeof fetchCompanyProfile>>> = {};
  for (const p of positions) {
    try {
      const prof = await fetchCompanyProfile(p.ticker);
      if (prof) profiles[p.ticker] = prof;
      else console.warn(`  ${Y}[profile] No data for ${p.ticker}${R}`);
    } catch (err) {
      console.warn(`  ${Y}[profile] Failed for ${p.ticker}: ${(err as Error).message}${R}`);
    }
  }

  const holdingTickers = positions.map((p) => p.ticker);
  const holdingSectors = [
    ...new Set(
      Object.values(profiles)
        .map((p) => p?.sector)
        .filter((s): s is string => Boolean(s))
    ),
  ];

  console.log(hr("─"));
  console.log(
    `${B}Holdings context:${R} ${holdingTickers.join("  ")}` +
    `\n${D}Sectors: ${holdingSectors.join(", ")}${R}`
  );
  console.log(hr("─"));

  // ── 3. Analyse news per ticker ──────────────────────────────────────────

  const summary: { verdict: string; ticker: string; geo: string | null }[] = [];

  for (const pos of positions) {
    const profile = profiles[pos.ticker];
    const sectorLabel = profile
      ? `${profile.sector} / ${profile.industry}`
      : "Unknown sector";

    console.log(
      `\n${B}${C}── ${pos.ticker}${R}  ${D}${pos.description}${R}` +
      `\n   ${D}${sectorLabel}  │  HQ: ${profile?.countryCode ?? "??"} ${flag(profile?.countryCode ?? null)}${R}`
    );

    let articles;
    try {
      articles = await fetchFinnhubNews(pos.ticker);
    } catch (err) {
      console.log(`  ${RD}Could not fetch news for ${pos.ticker}: ${(err as Error).message}${R}`);
      continue;
    }

    if (articles.length === 0) {
      console.log(`  ${D}No recent news found.${R}`);
      continue;
    }

    const top = articles.slice(0, 5);
    console.log(`  ${D}Analysing ${top.length} articles via brain…${R}`);

    for (let i = 0; i < top.length; i++) {
      const article = top[i];
      process.stdout.write(`  ${D}[${i + 1}/${top.length}] ${article.headline.slice(0, 55)}…${R}\r`);

      const analysis = await analyzeStory(
        pos.ticker,
        article.headline,
        article.summary ?? "",
        holdingTickers,
        holdingSectors
      );

      process.stdout.write(" ".repeat(80) + "\r");
      renderStory(i + 1, article.headline, analysis, pos.ticker);
      summary.push({ verdict: analysis.verdict, ticker: pos.ticker, geo: analysis.originCountryCode });
    }
  }

  // ── 4. Portfolio summary ────────────────────────────────────────────────

  console.log(`\n${hr("═")}`);
  console.log(`${B}Portfolio Summary${R}`);
  console.log(hr("─"));

  const buys  = summary.filter((s) => s.verdict === "BUY").length;
  const sells = summary.filter((s) => s.verdict === "SELL").length;
  const holds = summary.filter((s) => s.verdict === "HOLD").length;
  const total = summary.length || 1;

  console.log(
    `${G}${B}BUY${R}  ${bar(buys / total, 30)}  ${buys}` +
    `\n${RD}${B}SELL${R} ${bar(sells / total, 30)}  ${sells}` +
    `\n${Y}${B}HOLD${R} ${bar(holds / total, 30)}  ${holds}`
  );

  const geoCounts: Record<string, number> = {};
  for (const { geo } of summary) {
    if (geo) geoCounts[geo] = (geoCounts[geo] ?? 0) + 1;
  }
  const topGeo = Object.entries(geoCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, n]) => `${flag(code)} ${code} (${n})`)
    .join("  ");

  if (topGeo) {
    console.log(`\n${B}Top news origins:${R}  ${topGeo}`);
  }

  const overall = buys > sells ? "BUY" : sells > buys ? "SELL" : "HOLD";
  console.log(`\n${B}Overall signal:${R}  ${VERDICT_COLOR[overall]}${B}${overall}${R}`);
  console.log(hr("═") + "\n");
}

main().catch((err) => {
  console.error(`\n${RD}${B}Fatal error:${R}`, err);
  process.exit(1);
});
