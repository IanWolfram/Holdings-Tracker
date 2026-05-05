import fs from "fs";
import path from "path";
import { resolveVaultPath } from "../lib/constants";
import { loadCalibrationReport } from "./calibration";
import { loadPredictions } from "./predictions";
import { callMlxRaw } from "./brain";
import type { TickerResult } from "../lib/agent/service";

function readSubagentPrompt(filename: string): string {
  try {
    return fs
      .readFileSync(path.join(process.cwd(), "world-brain", "agents", filename), "utf-8")
      .trim();
  } catch {
    return "";
  }
}

interface SectorBreadthEntry {
  tickers: string[];
  todayBuyPct: number;
  rolling30dBuyPct: number;
  todayCount: number;
  rolling30dCount: number;
  momentum: string;
}

interface SectorBreadthReport {
  bySector: Record<string, SectorBreadthEntry>;
}

interface CorrelationReport {
  matrix?: Record<string, Record<string, number>>;
}

interface AlertsSummary {
  contradictions: number;
  breadthFlips: number;
  tickerClusters: number;
  sizingTickers: number;
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function writeFileAtomic(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, filePath);
}

function loadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4a. Same-day contradiction detector
// ---------------------------------------------------------------------------

function buildContradictionAlertContent(
  date: string,
  ticker: string,
  buys: TickerResult["verdicts"],
  sells: TickerResult["verdicts"],
  resolution: string | null
): string {
  const buyLines = buys.map(
    (v) =>
      `- **BUY** ${Math.round(v.analysis.confidence * 100)}% — [${v.headline}](${v.url})\n  ${(v.analysis.reason ?? "").slice(0, 200)}`
  );
  const sellLines = sells.map(
    (v) =>
      `- **SELL** ${Math.round(v.analysis.confidence * 100)}% — [${v.headline}](${v.url})\n  ${(v.analysis.reason ?? "").slice(0, 200)}`
  );

  return [
    "---",
    `date: "${date}"`,
    "type: alert",
    `subtype: contradiction`,
    `ticker: ${ticker}`,
    `buys: ${buys.length}`,
    `sells: ${sells.length}`,
    "tags:",
    "  - alert",
    "  - contradiction",
    `  - ${ticker.toLowerCase()}`,
    "---",
    "",
    `# Contradiction — [[${ticker}]] on ${date}`,
    "",
    `${buys.length} BUY signals and ${sells.length} SELL signals fired on the same day.`,
    "Resolve which catalyst dominates before forecasting.",
    "",
    "## BUY signals",
    ...(buyLines.length > 0 ? buyLines : ["- _none_"]),
    "",
    "## SELL signals",
    ...(sellLines.length > 0 ? sellLines : ["- _none_"]),
    "",
    ...(resolution
      ? ["## META-ANALYST Resolution", "", resolution.trim(), ""]
      : []),
  ].join("\n");
}

async function resolveContradictionWithMetaAnalyst(
  ticker: string,
  date: string,
  buys: TickerResult["verdicts"],
  sells: TickerResult["verdicts"]
): Promise<string | null> {
  const prompt = readSubagentPrompt("META-ANALYST.md");
  if (!prompt) return null;

  const formatVerdict = (v: TickerResult["verdicts"][number]): string =>
    `- ${v.verdict} ${Math.round(v.analysis.confidence * 100)}% — "${v.headline.slice(0, 100)}"\n  Reason: ${(v.analysis.reason ?? "").slice(0, 200)}`;

  const userMessage =
    `Same-day contradiction on ${ticker} (${date}). ${buys.length} BUY vs ${sells.length} SELL.\n\n` +
    `BUY signals:\n${buys.map(formatVerdict).join("\n")}\n\n` +
    `SELL signals:\n${sells.map(formatVerdict).join("\n")}\n\n` +
    `In 2-4 sentences, identify which catalyst type dominates the others over a 7-day horizon and why. ` +
    `End with a single recommended verdict: BUY, SELL, or HOLD. Plain prose, no headers, no JSON.`;

  try {
    const raw = await callMlxRaw(prompt, userMessage);
    return raw && raw.trim().length > 0 ? raw.trim() : null;
  } catch (err) {
    console.error(`[alerts] META-ANALYST resolve failed for ${ticker}:`, err);
    return null;
  }
}

async function detectContradictions(
  vaultPath: string,
  tickerResults: TickerResult[],
  date: string
): Promise<number> {
  let count = 0;
  for (const tr of tickerResults) {
    const nonFailed = tr.verdicts.filter((v) => !v.analysis.analysisFailed);
    const buys = nonFailed.filter((v) => v.verdict === "BUY");
    const sells = nonFailed.filter((v) => v.verdict === "SELL");
    if (buys.length >= 1 && sells.length >= 1 && buys.length + sells.length >= 2) {
      const resolution = await resolveContradictionWithMetaAnalyst(
        tr.ticker,
        date,
        buys,
        sells
      );
      const notePath = path.join(vaultPath, "_alerts", `${date}-contradiction-${tr.ticker}.md`);
      ensureDir(path.dirname(notePath));
      writeFileAtomic(
        notePath,
        buildContradictionAlertContent(date, tr.ticker, buys, sells, resolution)
      );
      count += 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// 4b. Sector breadth flip + ticker BUY cluster anomalies
// ---------------------------------------------------------------------------

function writeBreadthFlipAlert(
  vaultPath: string,
  date: string,
  sector: string,
  entry: SectorBreadthEntry,
  delta: number
): void {
  const alertsDir = path.join(vaultPath, "_alerts");
  ensureDir(alertsDir);
  const slug = sector.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const notePath = path.join(alertsDir, `${date}-breadth-flip-${slug || "sector"}.md`);

  const tickerLinks = entry.tickers.map((t) => `[[${t}]]`).join(", ") || "_none_";
  const direction = delta > 0 ? "↑ bullish" : "↓ bearish";

  const content = [
    "---",
    `date: "${date}"`,
    "type: alert",
    "subtype: breadth-flip",
    `sector: "${sector}"`,
    `delta: ${delta.toFixed(4)}`,
    "tags:",
    "  - alert",
    "  - breadth-flip",
    "---",
    "",
    `# Sector breadth flip — ${sector}`,
    "",
    `Today's BUY share is ${(entry.todayBuyPct * 100).toFixed(0)}% (${entry.todayCount} stories).`,
    `30-day baseline: ${(entry.rolling30dBuyPct * 100).toFixed(0)}% (${entry.rolling30dCount} stories).`,
    `Delta: **${(delta * 100).toFixed(0)} percentage points** ${direction}.`,
    "",
    `Tickers in this sector: ${tickerLinks}`,
    "",
  ].join("\n");

  writeFileAtomic(notePath, content);
}

function writeTickerClusterAlert(
  vaultPath: string,
  date: string,
  ticker: string,
  todayBuys: number,
  averageDaily: number
): void {
  const alertsDir = path.join(vaultPath, "_alerts");
  ensureDir(alertsDir);
  const notePath = path.join(alertsDir, `${date}-cluster-${ticker}.md`);

  const content = [
    "---",
    `date: "${date}"`,
    "type: alert",
    "subtype: ticker-cluster",
    `ticker: ${ticker}`,
    `todayBuys: ${todayBuys}`,
    `averageDaily: ${averageDaily.toFixed(2)}`,
    "tags:",
    "  - alert",
    "  - ticker-cluster",
    `  - ${ticker.toLowerCase()}`,
    "---",
    "",
    `# Ticker BUY cluster — [[${ticker}]]`,
    "",
    `${todayBuys} BUY signals today vs. 30-day daily average of ${averageDaily.toFixed(1)}.`,
    `Either coordinated catalyst or noise spike — verify before trusting the signal cluster.`,
    "",
  ].join("\n");

  writeFileAtomic(notePath, content);
}

function detectClusteringAnomalies(
  vaultPath: string,
  tickerResults: TickerResult[],
  date: string
): { breadthFlips: number; tickerClusters: number } {
  let breadthFlips = 0;
  let tickerClusters = 0;

  // Sector breadth flips: read today's _graph/sectors.json (written by Phase 2),
  // flag sectors whose todayBuyPct - rolling30dBuyPct > 50pts in either direction.
  const sectors = loadJson<SectorBreadthReport>(
    path.join(vaultPath, "_graph", "sectors.json")
  );
  if (sectors?.bySector) {
    for (const [sector, entry] of Object.entries(sectors.bySector)) {
      if (entry.todayCount < 3) continue; // need a real sample today
      if (entry.rolling30dCount < 5) continue; // need a real baseline
      const delta = entry.todayBuyPct - entry.rolling30dBuyPct;
      if (Math.abs(delta) >= 0.3) {
        writeBreadthFlipAlert(vaultPath, date, sector, entry, delta);
        breadthFlips += 1;
      }
    }
  }

  // Ticker BUY clusters: for each ticker, compare today's BUY count against the
  // 30-day daily average. We approximate the average by reading the news dir
  // and counting BUY-tagged frontmatter for this ticker over the last 30 days.
  const newsDir = path.join(vaultPath, "news");
  let perTickerHistory = new Map<string, number[]>();
  if (fs.existsSync(newsDir)) {
    perTickerHistory = aggregateTickerBuyCountsLast30Days(newsDir);
  }

  for (const tr of tickerResults) {
    const todayBuys = tr.verdicts.filter((v) => v.verdict === "BUY").length;
    if (todayBuys < 3) continue;
    const history = perTickerHistory.get(tr.ticker.toUpperCase()) ?? [];
    if (history.length < 3) continue;
    const total = history.reduce((sum, n) => sum + n, 0);
    const avg = total / history.length;
    if (todayBuys >= Math.max(3, avg * 3)) {
      writeTickerClusterAlert(vaultPath, date, tr.ticker, todayBuys, avg);
      tickerClusters += 1;
    }
  }

  return { breadthFlips, tickerClusters };
}

function aggregateTickerBuyCountsLast30Days(newsDir: string): Map<string, number[]> {
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const tickerBuckets = new Map<string, Map<string, number>>();

  for (const file of fs.readdirSync(newsDir)) {
    if (!file.endsWith(".md")) continue;
    if (file.slice(0, 10) < cutoff) continue;
    let content: string;
    try {
      content = fs.readFileSync(path.join(newsDir, file), "utf-8");
    } catch {
      continue;
    }
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm: Record<string, string> = {};
    for (const line of fmMatch[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      fm[line.slice(0, idx).trim()] = line
        .slice(idx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
    if (fm.verdict !== "BUY") continue;
    const ticker = fm.ticker?.toUpperCase();
    const date = fm.date;
    if (!ticker || !date) continue;
    const tickerMap = tickerBuckets.get(ticker) ?? new Map<string, number>();
    tickerMap.set(date, (tickerMap.get(date) ?? 0) + 1);
    tickerBuckets.set(ticker, tickerMap);
  }

  const result = new Map<string, number[]>();
  for (const [ticker, dateMap] of tickerBuckets.entries()) {
    result.set(ticker, [...dateMap.values()]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 4c. Position-sizing suggestions (read-only)
// ---------------------------------------------------------------------------

interface SizingEntry {
  ticker: string;
  base: number;
  directionConfidence: number;
  historicalAccuracy: number;
  portfolioCorrelation: number;
  suggestedAllocation: number;
  rationale: string;
}

interface SizingReport {
  updatedAt: string;
  entries: Record<string, SizingEntry>;
}

function meanAbsCorrelationToPortfolio(
  ticker: string,
  matrix: Record<string, Record<string, number>>
): number {
  const row = matrix[ticker];
  if (!row) return 0;
  const values = Object.entries(row)
    .filter(([peer]) => peer !== ticker)
    .map(([, corr]) => Math.abs(corr))
    .filter((v) => Number.isFinite(v));
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function updateSizingReport(
  vaultPath: string,
  tickerResults: TickerResult[]
): number {
  const calibration = loadCalibrationReport(vaultPath);
  const correlations = loadJson<CorrelationReport>(
    path.join(vaultPath, "_graph", "correlations.json")
  );
  const matrix = correlations?.matrix ?? {};

  const entries: Record<string, SizingEntry> = {};
  const base = 1 / Math.max(tickerResults.length, 1);

  for (const tr of tickerResults) {
    const ticker = tr.ticker.toUpperCase();
    const latest = loadPredictions(vaultPath, ticker, 7)
      .slice()
      .sort((a, b) => b.runAt - a.runAt)[0];
    const directionConfidence =
      latest?.direction === "FLAT" ? 0 : Math.max(0, Math.min(1, latest?.confidence ?? 0));

    const tickerStats = calibration?.byTicker?.[ticker];
    const historicalAccuracy =
      tickerStats && tickerStats.n >= 3 ? tickerStats.winRate : 0.5;

    const meanCorr = meanAbsCorrelationToPortfolio(ticker, matrix);
    // Diversification factor: penalize tickers that move with the rest of the book.
    const diversification = Math.max(0, 1 - meanCorr);

    const suggestedAllocation = Number(
      (base * directionConfidence * historicalAccuracy * diversification).toFixed(4)
    );

    entries[ticker] = {
      ticker,
      base: Number(base.toFixed(4)),
      directionConfidence: Number(directionConfidence.toFixed(4)),
      historicalAccuracy: Number(historicalAccuracy.toFixed(4)),
      portfolioCorrelation: Number(meanCorr.toFixed(4)),
      suggestedAllocation,
      rationale:
        latest && directionConfidence > 0
          ? `${latest.direction} ${latest.magnitudePct}% @ ${Math.round(directionConfidence * 100)}% conf, ${Math.round(historicalAccuracy * 100)}% historical accuracy, mean |corr| ${meanCorr.toFixed(2)}`
          : "no directional 7d prediction available — sizing collapses to 0",
    };
  }

  const report: SizingReport = {
    updatedAt: new Date().toISOString(),
    entries,
  };

  const metricsDir = path.join(vaultPath, "_metrics");
  ensureDir(metricsDir);
  writeFileAtomic(
    path.join(metricsDir, "sizing.json"),
    JSON.stringify(report, null, 2)
  );

  return Object.keys(entries).length;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface AlertsPassInput {
  vaultPath: string;
  date: string;
  tickerResults: TickerResult[];
}

export async function runAlertsPass(input: AlertsPassInput): Promise<AlertsSummary> {
  const resolved = resolveVaultPath(input.vaultPath) ?? input.vaultPath;
  if (!resolved) {
    return { contradictions: 0, breadthFlips: 0, tickerClusters: 0, sizingTickers: 0 };
  }

  const contradictions = await detectContradictions(resolved, input.tickerResults, input.date);
  const { breadthFlips, tickerClusters } = detectClusteringAnomalies(
    resolved,
    input.tickerResults,
    input.date
  );
  const sizingTickers = updateSizingReport(resolved, input.tickerResults);

  console.log(
    `[alerts] contradictions=${contradictions} breadthFlips=${breadthFlips} clusters=${tickerClusters} sizing=${sizingTickers}`
  );

  return { contradictions, breadthFlips, tickerClusters, sizingTickers };
}
