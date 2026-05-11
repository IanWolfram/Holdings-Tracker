import fs from "fs";
import path from "path";
import { resolveVaultPath, FALLBACK_CONFIDENCE } from "../lib/constants";
import { debug } from "../lib/debug";
import { getDailyBars } from "../lib/marketdata/prices";
import { CATALYST_TYPES, type CatalystType } from "../types/predictions";
import { loadCalibrationReport, type CalibrationStats } from "./calibration";
import type { VaultStore } from "@/lib/vault/store";

interface NewsRecord {
  file: string;
  date: string;
  ticker: string;
  sector?: string;
  verdict: string;
  confidence: number;
  catalystTypes: CatalystType[];
  headline: string;
  url?: string;
}

function parseFrontmatter(content: string): Record<string, string | string[]> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const result: Record<string, string | string[]> = {};
  const lines = match[1].split("\n");
  let currentListKey: string | null = null;

  for (const line of lines) {
    if (currentListKey && /^\s+-\s+/.test(line)) {
      const value = line.replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, "");
      const arr = result[currentListKey];
      if (Array.isArray(arr)) arr.push(value);
      else result[currentListKey] = [value];
      continue;
    }

    currentListKey = null;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();
    if (!key) continue;
    if (raw === "" || raw === "|" || raw === ">") {
      currentListKey = key;
      result[key] = [];
      continue;
    }
    result[key] = raw.replace(/^["']|["']$/g, "");
  }
  return result;
}

function readHeadline(content: string, fallback: string): string {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fallback;
}

function readNewsRecord(filePath: string): NewsRecord | null {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const fm = parseFrontmatter(content);
  const ticker = typeof fm.ticker === "string" ? fm.ticker.toUpperCase() : null;
  const date = typeof fm.date === "string" ? fm.date : null;
  const verdict = typeof fm.verdict === "string" ? fm.verdict.toUpperCase() : null;
  if (!ticker || !date || !verdict) return null;

  const sector = typeof fm.sector === "string" ? fm.sector : undefined;
  const url = typeof fm.url === "string" ? fm.url : undefined;
  const confidenceRaw = typeof fm.confidence === "string" ? parseFloat(fm.confidence) : FALLBACK_CONFIDENCE;
  const confidence = Number.isFinite(confidenceRaw) ? confidenceRaw : FALLBACK_CONFIDENCE;

  const rawTypes = Array.isArray(fm.catalystTypes) ? fm.catalystTypes : [];
  const catalystTypes = rawTypes.filter((t): t is CatalystType =>
    (CATALYST_TYPES as readonly string[]).includes(t)
  );

  return {
    file: filePath,
    date,
    ticker,
    sector,
    verdict,
    confidence,
    catalystTypes,
    headline: readHeadline(content, path.basename(filePath, ".md")),
    url,
  };
}

function loadAllNews(vaultPath: string): NewsRecord[] {
  const newsDir = path.join(vaultPath, "news");
  if (!fs.existsSync(newsDir)) return [];

  const records: NewsRecord[] = [];
  for (const file of fs.readdirSync(newsDir)) {
    if (!file.endsWith(".md")) continue;
    const record = readNewsRecord(path.join(newsDir, file));
    if (record) records.push(record);
  }
  return records;
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

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// 2a. Catalyst-type nodes
// ---------------------------------------------------------------------------

const EMPTY_STATS: CalibrationStats = {
  n: 0,
  correct: 0,
  partial: 0,
  incorrect: 0,
  winRate: 0,
  avgConfidence: 0,
};

export async function updateCatalystPages(vaultPath: string, store?: VaultStore): Promise<{ written: number }> {
  const resolved = resolveVaultPath(vaultPath) ?? vaultPath;
  const news = loadAllNews(resolved);
  const report = store ? await loadCalibrationReport(store) : null;
  const catalystsDir = path.join(resolved, "catalysts");
  ensureDir(catalystsDir);

  let written = 0;
  for (const type of CATALYST_TYPES) {
    if (type === "other") continue;
    const stats = report?.byCatalyst?.[type] ?? EMPTY_STATS;
    const items = news
      .filter((n) => n.catalystTypes.includes(type))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 25);

    const verdictCounts = items.reduce(
      (acc, n) => {
        if (n.verdict === "BUY") acc.buy += 1;
        else if (n.verdict === "SELL") acc.sell += 1;
        else acc.hold += 1;
        return acc;
      },
      { buy: 0, sell: 0, hold: 0 }
    );

    const winRateLine =
      stats.n > 0
        ? `Win rate: ${pct(stats.winRate)} (${stats.correct}/${stats.n}), avg confidence ${stats.avgConfidence.toFixed(2)}`
        : "Win rate: insufficient resolved predictions yet.";

    const itemLines =
      items.length > 0
        ? items.map(
            (n) =>
              `- [${n.date}] **${n.verdict}** ${pct(n.confidence)} — [[${n.ticker}]] — ${n.headline.slice(0, 100)}`
          )
        : ["- No tagged news yet."];

    const body = [
      "---",
      `type: catalyst`,
      `name: "${type}"`,
      `n: ${stats.n}`,
      `winRate: ${stats.winRate.toFixed(4)}`,
      `avgConfidence: ${stats.avgConfidence.toFixed(4)}`,
      `newsCount: ${items.length}`,
      "tags:",
      "  - catalyst",
      "  - graph",
      `  - catalyst-${type}`,
      "---",
      "",
      `# Catalyst — ${type}`,
      "",
      winRateLine,
      `Recent stories tagged with this catalyst: ${items.length}`,
      `Verdict mix: ${verdictCounts.buy} BUY / ${verdictCounts.sell} SELL / ${verdictCounts.hold} HOLD`,
      "",
      "## Recent Stories",
      ...itemLines,
      "",
    ].join("\n");

    writeFileAtomic(path.join(catalystsDir, `${type}.md`), body);
    written += 1;
  }

  return { written };
}

// ---------------------------------------------------------------------------
// 2b. Sector breadth & momentum
// ---------------------------------------------------------------------------

export interface SectorBreadthEntry {
  tickers: string[];
  todayCount: number;
  todayBuyPct: number;
  rolling7dCount: number;
  rolling7dBuyPct: number;
  rolling30dCount: number;
  rolling30dBuyPct: number;
  momentum: "strong" | "neutral" | "weak";
}

export interface SectorBreadthReport {
  updatedAt: string;
  bySector: Record<string, SectorBreadthEntry>;
}

function classifyMomentum(rolling7d: number, rolling30d: number, n7d: number): SectorBreadthEntry["momentum"] {
  if (n7d < 3) return "neutral";
  if (rolling7d >= 0.65 && rolling7d > rolling30d) return "strong";
  if (rolling7d <= 0.35 && rolling7d < rolling30d) return "weak";
  return "neutral";
}

function buyRatio(records: NewsRecord[]): number {
  if (records.length === 0) return 0;
  const buys = records.filter((r) => r.verdict === "BUY").length;
  return buys / records.length;
}

export function updateSectorGraph(
  vaultPath: string,
  profiles: Record<string, { sector?: string }>
): { written: number } {
  const resolved = resolveVaultPath(vaultPath) ?? vaultPath;
  const news = loadAllNews(resolved);

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const tickerToSector = new Map<string, string>();
  for (const [ticker, profile] of Object.entries(profiles)) {
    if (profile.sector) tickerToSector.set(ticker.toUpperCase(), profile.sector);
  }

  const sectorBuckets = new Map<string, NewsRecord[]>();
  for (const record of news) {
    const sector = record.sector ?? tickerToSector.get(record.ticker) ?? "Uncategorized";
    const bucket = sectorBuckets.get(sector) ?? [];
    bucket.push(record);
    sectorBuckets.set(sector, bucket);
  }

  const bySector: Record<string, SectorBreadthEntry> = {};
  for (const [sector, records] of sectorBuckets.entries()) {
    const todayRecords = records.filter((r) => r.date === today);
    const sevenDayRecords = records.filter((r) => r.date >= sevenDaysAgo);
    const thirtyDayRecords = records.filter((r) => r.date >= thirtyDaysAgo);

    const tickers = [...new Set(records.map((r) => r.ticker))].sort();
    const rolling7d = buyRatio(sevenDayRecords);
    const rolling30d = buyRatio(thirtyDayRecords);

    bySector[sector] = {
      tickers,
      todayCount: todayRecords.length,
      todayBuyPct: Number(buyRatio(todayRecords).toFixed(4)),
      rolling7dCount: sevenDayRecords.length,
      rolling7dBuyPct: Number(rolling7d.toFixed(4)),
      rolling30dCount: thirtyDayRecords.length,
      rolling30dBuyPct: Number(rolling30d.toFixed(4)),
      momentum: classifyMomentum(rolling7d, rolling30d, sevenDayRecords.length),
    };
  }

  const report: SectorBreadthReport = {
    updatedAt: new Date().toISOString(),
    bySector,
  };

  const graphDir = path.join(resolved, "_graph");
  writeFileAtomic(path.join(graphDir, "sectors.json"), JSON.stringify(report, null, 2));

  const sectorPagesDir = path.join(resolved, "sectors");
  ensureDir(sectorPagesDir);
  let written = 0;
  for (const [sector, entry] of Object.entries(bySector)) {
    const slug = sector.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const tickerLinks = entry.tickers.map((t) => `[[${t}]]`).join(", ") || "_none_";
    const body = [
      "---",
      "type: sector",
      `name: "${sector}"`,
      `momentum: ${entry.momentum}`,
      `todayBuyPct: ${entry.todayBuyPct.toFixed(4)}`,
      `rolling7dBuyPct: ${entry.rolling7dBuyPct.toFixed(4)}`,
      `rolling30dBuyPct: ${entry.rolling30dBuyPct.toFixed(4)}`,
      "tags:",
      "  - sector",
      "  - graph",
      "---",
      "",
      `# Sector — ${sector}`,
      "",
      `Tickers: ${tickerLinks}`,
      "",
      "## Breadth",
      `- Today: ${entry.todayCount} stories, ${pct(entry.todayBuyPct)} BUY`,
      `- Rolling 7d: ${entry.rolling7dCount} stories, ${pct(entry.rolling7dBuyPct)} BUY`,
      `- Rolling 30d: ${entry.rolling30dCount} stories, ${pct(entry.rolling30dBuyPct)} BUY`,
      `- Momentum: **${entry.momentum}**`,
      "",
    ].join("\n");
    writeFileAtomic(path.join(sectorPagesDir, `${slug || "sector"}.md`), body);
    written += 1;
  }

  return { written };
}

// ---------------------------------------------------------------------------
// 2c. Cross-ticker correlation graph
// ---------------------------------------------------------------------------

export interface CorrelationReport {
  updatedAt: string;
  windowDays: number;
  tickers: string[];
  matrix: Record<string, Record<string, number>>;
}

function logReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] <= 0 || !Number.isFinite(closes[i]) || !Number.isFinite(closes[i - 1])) continue;
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  return returns;
}

function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  const x = a.slice(a.length - n);
  const y = b.slice(b.length - n);
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return null;
  return num / Math.sqrt(denomX * denomY);
}

export async function updateCorrelationGraph(
  vaultPath: string,
  tickers: string[],
  windowDays: number = 30
): Promise<{ tickers: string[]; pairs: number }> {
  const resolved = resolveVaultPath(vaultPath) ?? vaultPath;
  const uniqueTickers = [...new Set(tickers.map((t) => t.toUpperCase()))].sort();
  if (uniqueTickers.length < 2) {
    return { tickers: uniqueTickers, pairs: 0 };
  }

  const seriesByTicker = new Map<string, number[]>();
  for (const ticker of uniqueTickers) {
    try {
      const bars = await getDailyBars(ticker, Math.max(windowDays + 5, 60));
      if (bars.length < windowDays / 2) continue;
      const recent = bars.slice(bars.length - windowDays - 1);
      seriesByTicker.set(ticker, logReturns(recent.map((b) => b.close)));
    } catch (err) {
      console.warn(`[graph] correlation: failed to fetch bars for ${ticker}:`, (err as Error).message);
    }
  }

  const usableTickers = [...seriesByTicker.keys()].sort();
  const matrix: Record<string, Record<string, number>> = {};
  let pairs = 0;
  for (const a of usableTickers) {
    matrix[a] = {};
    for (const b of usableTickers) {
      if (a === b) {
        matrix[a][b] = 1;
        continue;
      }
      const corr = pearson(seriesByTicker.get(a)!, seriesByTicker.get(b)!);
      if (corr === null) continue;
      matrix[a][b] = Number(corr.toFixed(4));
      if (a < b) pairs += 1;
    }
  }

  const report: CorrelationReport = {
    updatedAt: new Date().toISOString(),
    windowDays,
    tickers: usableTickers,
    matrix,
  };

  const graphDir = path.join(resolved, "_graph");
  writeFileAtomic(path.join(graphDir, "correlations.json"), JSON.stringify(report, null, 2));

  const headerRow = ["|        |", ...usableTickers.map((t) => ` ${t} |`)].join("");
  const dividerRow = ["|--------|", ...usableTickers.map(() => "-------|")].join("");
  const dataRows = usableTickers.map((a) => {
    const cells = usableTickers.map((b) => {
      const v = matrix[a]?.[b];
      return v === undefined ? "   —   " : v.toFixed(2).padStart(6, " ");
    });
    return `| ${a.padEnd(6)} | ${cells.join(" | ")} |`;
  });

  const md = [
    "---",
    "type: correlation-matrix",
    `windowDays: ${windowDays}`,
    `tickers: ${usableTickers.length}`,
    "tags:",
    "  - graph",
    "  - correlation",
    "---",
    "",
    `# Correlation Matrix — rolling ${windowDays}-day log returns`,
    "",
    `Updated: ${report.updatedAt}`,
    "",
    headerRow,
    dividerRow,
    ...dataRows,
    "",
    "## Top Pairs",
    ...usableTickers
      .flatMap((a) =>
        usableTickers
          .filter((b) => a < b && matrix[a]?.[b] !== undefined)
          .map((b) => ({ a, b, corr: matrix[a][b] }))
      )
      .sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr))
      .slice(0, 5)
      .map((p) => `- [[${p.a}]] ↔ [[${p.b}]]: ${p.corr.toFixed(2)}`),
    "",
  ].join("\n");

  writeFileAtomic(path.join(graphDir, "correlations.md"), md);

  return { tickers: usableTickers, pairs };
}

// ---------------------------------------------------------------------------
// 2d. Supply chain map (renders hand-curated source to vault)
// ---------------------------------------------------------------------------

interface SupplyChainEdge {
  from: string;
  to: string;
  via: string;
}

interface SupplyChainSource {
  edges: SupplyChainEdge[];
}

function loadSupplyChainSource(): SupplyChainSource | null {
  const sourcePath = path.join(process.cwd(), "world-brain", "supply-chain.md");
  if (!fs.existsSync(sourcePath)) return null;

  const raw = fs.readFileSync(sourcePath, "utf-8");
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const edges: SupplyChainEdge[] = [];
  const lines = fmMatch[1].split("\n");
  let inEdges = false;
  let current: Partial<SupplyChainEdge> = {};
  for (const line of lines) {
    if (/^edges:\s*$/.test(line)) {
      inEdges = true;
      continue;
    }
    if (!inEdges) continue;
    if (/^\s+-\s+/.test(line)) {
      if (current.from && current.to) edges.push(current as SupplyChainEdge);
      current = {};
      const inline = line.replace(/^\s+-\s+/, "");
      const kv = inline.match(/^(\w+):\s*(.+)$/);
      if (kv) {
        (current as Record<string, string>)[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
      }
    } else if (/^\s+\w+:/.test(line)) {
      const kv = line.trim().match(/^(\w+):\s*(.+)$/);
      if (kv) {
        (current as Record<string, string>)[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  if (current.from && current.to) edges.push(current as SupplyChainEdge);

  return { edges };
}

export function updateSupplyChainGraph(vaultPath: string): { edges: number } {
  const resolved = resolveVaultPath(vaultPath) ?? vaultPath;
  const source = loadSupplyChainSource();
  const graphDir = path.join(resolved, "_graph");

  if (!source || source.edges.length === 0) {
    return { edges: 0 };
  }

  const edgeLines = source.edges.map((e) => {
    const fromLink = /^[A-Z]{1,5}$/.test(e.from) ? `[[${e.from}]]` : e.from;
    const toLink = /^[A-Z]{1,5}$/.test(e.to) ? `[[${e.to}]]` : e.to;
    return `- ${fromLink} → ${toLink} _(via ${e.via})_`;
  });

  const md = [
    "---",
    "type: supply-chain",
    `edges: ${source.edges.length}`,
    "tags:",
    "  - graph",
    "  - supply-chain",
    "---",
    "",
    "# Supply Chain Map",
    "",
    "Hand-curated dependency edges between tracked tickers and upstream/downstream entities.",
    "",
    ...edgeLines,
    "",
  ].join("\n");

  writeFileAtomic(path.join(graphDir, "supply-chain.md"), md);
  return { edges: source.edges.length };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function runGraphPass(
  vaultPath: string,
  profiles: Record<string, { sector?: string }>,
  tickers: string[],
  store?: VaultStore
): Promise<void> {
  if (!vaultPath) return;
  debug("graph", "Running graph pass...");

  const catalystResult = await updateCatalystPages(vaultPath, store);
  debug("graph", `Catalyst pages: ${catalystResult.written}`);

  const sectorResult = updateSectorGraph(vaultPath, profiles);
  debug("graph", `Sector pages: ${sectorResult.written}`);

  try {
    const corrResult = await updateCorrelationGraph(vaultPath, tickers);
    debug("graph", `Correlation pairs: ${corrResult.pairs} across ${corrResult.tickers.length} tickers`);
  } catch (err) {
    console.warn("[graph] Correlation pass failed:", (err as Error).message);
  }

  const supplyResult = updateSupplyChainGraph(vaultPath);
  debug("graph", `Supply chain edges: ${supplyResult.edges}`);
}
