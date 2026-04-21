import fs from "fs";
import path from "path";
import { callMlxRaw, invalidateSystemPromptCache } from "./brain";
import type { AgentRunResult } from "../lib/agent/service";

export interface VaultStory {
  headline: string;
  verdict: string;
  confidence: number;
  reason: string;
  date: string;
}

function getSubagentPrompt(filename: string): string {
  try {
    const dir = path.join(process.cwd(), "world-brain", "agents");
    return fs.readFileSync(path.join(dir, filename), "utf-8").trim();
  } catch (err) {
    console.error(`[learn] Failed to read subagent prompt ${filename}:`, err);
    return "";
  }
}

import { resolveVaultPath as _resolveVaultPath } from "../lib/constants";
function resolveVaultPath(vaultPath: string): string {
  return _resolveVaultPath(vaultPath) ?? vaultPath;
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) result[key] = val;
  }
  return result;
}

export function getRecentVaultStories(
  ticker: string,
  vaultPath: string,
  limit: number = 3
): VaultStory[] {
  const newsDir = path.join(resolveVaultPath(vaultPath), "news");
  try {
    const files = fs.readdirSync(newsDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();

    const results: VaultStory[] = [];
    for (const file of files) {
      if (results.length >= limit) break;
      try {
        const content = fs.readFileSync(path.join(newsDir, file), "utf-8");
        const fm = parseFrontmatter(content);
        if (fm.ticker?.toUpperCase() !== ticker.toUpperCase()) continue;
        if (!fm.verdict || !["BUY", "SELL", "HOLD"].includes(fm.verdict)) continue;

        const analysisMatch = content.match(/## AI Analysis\n([\s\S]*?)(?:\n##|$)/);
        const reason = (analysisMatch?.[1]?.trim() ?? "").replace(/_No analysis available\._/g, "").trim();
        if (!reason) continue;

        const headline = content.match(/^# (.+)$/m)?.[1]?.trim() ?? file;
        results.push({
          headline,
          verdict: fm.verdict,
          confidence: parseFloat(fm.confidence ?? "0.5") || 0.5,
          reason,
          date: fm.date ?? file.slice(0, 10),
        });
      } catch { /* skip unreadable files */ }
    }
    return results;
  } catch {
    return [];
  }
}

export async function buildTickerKnowledge(
  ticker: string,
  vaultPath: string,
  sector?: string,
  limit: number = 30
): Promise<string> {
  const stories = getRecentVaultStories(ticker, vaultPath, limit);
  if (stories.length === 0) return "";

  const storyList = stories
    .map((s, i) =>
      `${i + 1}. [${s.date}] ${s.verdict} (${Math.round(s.confidence * 100)}%) — "${s.headline.slice(0, 100)}"\n   Reason: ${s.reason.slice(0, 150)}`
    )
    .join("\n\n");

  const userMessage =
    `You are synthesizing observed trading signal patterns for a financial AI system.\n\n` +
    `Ticker: ${ticker}\n` +
    (sector ? `Sector: ${sector}\n` : "") +
    `\nBelow are the last ${stories.length} analyzed news stories for ${ticker}, sorted most recent first:\n\n` +
    storyList +
    `\n\nBased on these patterns, write a 3-5 sentence knowledge block covering:\n` +
    `1. What types of headlines have reliably triggered BUY signals for ${ticker}\n` +
    `2. What types of headlines have triggered SELL signals\n` +
    `3. Any recurring sector themes or geopolitical factors\n` +
    `4. Confidence calibration notes (e.g., "analyst upgrades typically score 0.75-0.85")\n\n` +
    `Write ONLY the knowledge block as plain prose. No headers. No JSON. No preamble. No mention of "knowledge block."`;

  const result = await callMlxRaw(getSubagentPrompt("ARCHIVIST.md"), userMessage);
  return result;
}

export async function updateTickerKnowledgeFile(
  ticker: string,
  vaultPath: string,
  sector?: string
): Promise<void> {
  if (!vaultPath) return;

  const synthesis = await buildTickerKnowledge(ticker, vaultPath, sector);
  if (!synthesis) {
    console.log(`[learn] No vault stories for ${ticker}, skipping knowledge update.`);
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const content =
    `---\ndate: "${today}"\ntype: ticker-knowledge\nticker: ${ticker}\n` +
    (sector ? `sector: ${sector}\n` : "") +
    `generated: true\n---\n\n` +
    `# ${ticker} — Learned Patterns\n\n` +
    `${synthesis}\n\n` +
    `_Last updated: ${today}_\n`;

  const filePath = path.join(resolveVaultPath(vaultPath), `${ticker}.md`);
  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`[learn] Updated knowledge file for ${ticker}`);
}

export async function runMetaReflection(
  sessionResult: AgentRunResult,
  vaultPath: string,
  profiles: Record<string, { sector?: string }>
): Promise<void> {
  if (!vaultPath || sessionResult.tickerResults.length === 0) return;

  const today = new Date().toISOString().split("T")[0];

  const perTickerSummary = sessionResult.tickerResults
    .map((tr) => {
      const buys = tr.verdicts.filter((v) => v.verdict === "BUY").length;
      const sells = tr.verdicts.filter((v) => v.verdict === "SELL").length;
      const holds = tr.verdicts.length - buys - sells;
      const sector = profiles[tr.ticker]?.sector ?? "Unknown";
      const top = tr.verdicts[0];
      return (
        `${tr.ticker} (${sector}): ${buys} BUY / ${sells} SELL / ${holds} HOLD` +
        (top ? `\n  Top signal: "${top.headline.slice(0, 80)}" → ${top.verdict} (${Math.round(top.analysis.confidence * 100)}%)` : "")
      );
    })
    .join("\n");

  const sessionSummary =
    `Date: ${today}\n` +
    `Tickers covered: ${sessionResult.tickerResults.map((t) => t.ticker).join(", ")}\n` +
    `Session totals: ${sessionResult.totalBuys} BUY / ${sessionResult.totalSells} SELL / ${sessionResult.totalHolds} HOLD\n\n` +
    `Per-ticker breakdown:\n${perTickerSummary}`;

  const userMessage =
    `Synthesize cross-ticker and macro patterns from today's analysis session.\n\n` +
    sessionSummary +
    `\n\nWrite 3-6 sentences identifying:\n` +
    `(1) Any macro or geopolitical themes driving signals across multiple tickers today\n` +
    `(2) Cross-sector correlations observed\n` +
    `(3) Signal calibration notes (what confidence levels appeared for which catalyst types)\n` +
    `(4) Any anomalies or contradictions worth flagging for future sessions\n\n` +
    `Output only plain prose. No headers, no lists, no JSON.`;

  const reflection = await callMlxRaw(getSubagentPrompt("META-ANALYST.md"), userMessage);
  if (!reflection) {
    console.log("[learn] Meta-reflection returned empty — skipping market-insights update.");
    return;
  }

  const insightsPath = path.join(process.cwd(), "world-brain", "market-insights.md");
  const section = `\n## Session Insights — ${today}\n\n${reflection}\n\n---\n`;
  fs.appendFileSync(insightsPath, section, "utf-8");
  console.log("[learn] Market insights updated.");

  invalidateSystemPromptCache();
}

export async function runLearningPass(
  sessionResult: AgentRunResult,
  vaultPath: string,
  profiles: Record<string, { sector?: string }>
): Promise<void> {
  if (!vaultPath || sessionResult.tickerResults.length === 0) return;

  console.log(`[learn] Starting learning pass for ${sessionResult.tickerResults.length} tickers...`);

  for (const tr of sessionResult.tickerResults) {
    const sector = profiles[tr.ticker]?.sector;
    await updateTickerKnowledgeFile(tr.ticker, vaultPath, sector);
  }

  await runMetaReflection(sessionResult, vaultPath, profiles);
  console.log("[learn] Learning pass complete.");
}
