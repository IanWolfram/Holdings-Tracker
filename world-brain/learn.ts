import fs from "fs";
import path from "path";
import { FALLBACK_CONFIDENCE } from "../lib/constants";
import { debug } from "../lib/debug";
import { callLlm, invalidateSystemPromptCache } from "./brain";
import { getRecentResolvedPredictions } from "./predictions";
import { runGraphPass } from "./graph";
import { getMacroSnapshot } from "../lib/marketdata/macro";
import {
  appendVaultLog,
  buildVerdictTrend,
  findRecentContradictions,
  findTopRecentStories,
} from "./vault-meta";
import type { AgentRunResult } from "../lib/agent/service";
import type { VaultStore } from "@/lib/vault/store";

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

// Stories with decay below this threshold are treated as stale and excluded
// from the few-shot context the brain sees on each new analysis. Roughly
// equivalent to "older than ~3 weeks": exp(-21/7) ≈ 0.05.
const STALE_DECAY_THRESHOLD = 0.05;

export async function getRecentVaultStories(
  ticker: string,
  store: VaultStore,
  limit: number = 3
): Promise<VaultStory[]> {
  try {
    const files = (await store.list("news"))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();

    const results: VaultStory[] = [];
    const nowMs = Date.now();
    for (const file of files) {
      if (results.length >= limit) break;
      try {
        const content = await store.read(`news/${file}`);
        if (content === null) continue;
        const fm = parseFrontmatter(content);
        if (fm.ticker?.toUpperCase() !== ticker.toUpperCase()) continue;
        if (!fm.verdict || !["BUY", "SELL", "HOLD"].includes(fm.verdict)) continue;
        if (fm.analysisFailed === "true") continue;

        let decayScore = parseFloat(fm.decayScore ?? "");
        if (!Number.isFinite(decayScore)) {
          const dateStr = fm.date ?? file.slice(0, 10);
          const ts = Date.parse(`${dateStr}T16:00:00Z`);
          if (Number.isFinite(ts)) {
            const ageDays = Math.max(0, (nowMs - ts) / 86_400_000);
            decayScore = Math.exp(-ageDays / 7);
          } else {
            decayScore = 1;
          }
        }
        if (decayScore < STALE_DECAY_THRESHOLD) continue;

        const analysisMatch = content.match(/## AI Analysis\n([\s\S]*?)(?:\n##|$)/);
        const reason = (analysisMatch?.[1]?.trim() ?? "").replace(/_No analysis available\._/g, "").trim();
        if (!reason) continue;

        const headline = content.match(/^# (.+)$/m)?.[1]?.trim() ?? file;
        results.push({
          headline,
          verdict: fm.verdict,
          confidence: parseFloat(fm.confidence ?? String(FALLBACK_CONFIDENCE)) || FALLBACK_CONFIDENCE,
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
  store: VaultStore,
  sector?: string,
  limit: number = 30
): Promise<string> {
  const stories = await getRecentVaultStories(ticker, store, limit);
  if (stories.length === 0) return "";

  const storyList = stories
    .map((s, i) =>
      `${i + 1}. [${s.date}] ${s.verdict} (${Math.round(s.confidence * 100)}%) — "${s.headline.slice(0, 100)}"\n   Reason: ${s.reason.slice(0, 150)}`
    )
    .join("\n\n");

  // Include resolved prediction history for self-calibration
  let calibrationBlock = "";
  try {
    const resolved = await getRecentResolvedPredictions(store, ticker, 5);
    if (resolved.length > 0) {
      calibrationBlock =
        `\n\nRecent prediction outcomes for ${ticker} (use for self-calibration):\n` +
        resolved.map((p, i) => {
          const sign = (p.actualPct ?? 0) >= 0 ? "+" : "";
          return `${i + 1}. [${new Date(p.runAt).toISOString().slice(0, 10)}] Predicted ${p.direction} +/-${p.magnitudePct}% (conf ${Math.round(p.confidence * 100)}%) → ${p.outcome} (actual ${sign}${p.actualPct?.toFixed(1) ?? "?"}%)`;
        }).join("\n") +
        `\n\nIf accuracy reveals systematic over/under-confidence in a catalyst type, add a one-sentence calibration rule (e.g. "Analyst upgrade signals for this ticker historically under-perform predicted magnitude by ~40%").`;
    }
  } catch { /* calibration data is optional */ }

  const userMessage =
    `You are synthesizing observed trading signal patterns for a financial AI system.\n\n` +
    `Ticker: ${ticker}\n` +
    (sector ? `Sector: ${sector}\n` : "") +
    `\nBelow are the last ${stories.length} analyzed news stories for ${ticker}, sorted most recent first:\n\n` +
    storyList +
    calibrationBlock +
    `\n\nBased on these patterns, write a 3-5 sentence knowledge block covering:\n` +
    `1. What types of headlines have reliably triggered BUY signals for ${ticker}\n` +
    `2. What types of headlines have triggered SELL signals\n` +
    `3. Any recurring sector themes or geopolitical factors\n` +
    `4. Confidence calibration notes (e.g., "analyst upgrades typically score 0.75-0.85")\n\n` +
    `Write ONLY the knowledge block as plain prose. No headers. No JSON. No preamble. No mention of "knowledge block."`;

  const result = await callLlm(getSubagentPrompt("ARCHIVIST.md"), userMessage);
  return result;
}

export async function updateTickerKnowledgeFile(
  ticker: string,
  store: VaultStore,
  sector?: string
): Promise<void> {
  const synthesis = await buildTickerKnowledge(ticker, store, sector);
  if (!synthesis) {
    debug("learn", `No vault stories for ${ticker}, skipping knowledge update.`);
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const trend = await buildVerdictTrend(store, ticker, 7);
  const contradictions = await findRecentContradictions(store, ticker, 5);
  const topStories = await findTopRecentStories(store, ticker, 8);

  const trendBlock =
    trend.length > 0
      ? [
          "## Verdict Trend (last 7 sessions)",
          "",
          "| Date | BUY | SELL | HOLD | Top Signal |",
          "|------|----:|-----:|-----:|------------|",
          ...trend.map((row) => {
            const top = row.topSignal
              ? `**${row.topSignal.verdict}** ${Math.round(row.topSignal.confidence * 100)}% — ${row.topSignal.headline.slice(0, 70)}`
              : "—";
            return `| ${row.date} | ${row.buys} | ${row.sells} | ${row.holds} | ${top} |`;
          }),
          "",
        ].join("\n")
      : "";

  const contradictionBlock =
    contradictions.length > 0
      ? [
          "## Open Contradictions",
          "",
          ...contradictions.map(
            (a) =>
              `- [[_alerts/${a.filename}]] — ${a.buys} BUY vs ${a.sells} SELL on ${a.date}`
          ),
          "",
        ].join("\n")
      : "";

  const topStoriesBlock =
    topStories.length > 0
      ? [
          "## Top Recent Stories",
          "",
          ...topStories.map(
            (s) =>
              `- **${s.verdict}** ${Math.round(s.confidence * 100)}% — [[news/${s.filename}|${s.headline.slice(0, 90)}]] _(${s.date})_`
          ),
          "",
        ].join("\n")
      : "";

  const sections: string[] = [];
  if (trendBlock) sections.push(trendBlock);
  if (contradictionBlock) sections.push(contradictionBlock);
  if (topStoriesBlock) sections.push(topStoriesBlock);
  sections.push(`## Learned Patterns\n\n${synthesis}\n`);

  const content = [
    "---",
    `date: "${today}"`,
    "type: ticker-knowledge",
    `ticker: ${ticker}`,
    ...(sector ? [`sector: ${sector}`] : []),
    "generated: true",
    "tags:",
    "  - ticker-hub",
    `  - ${ticker.toLowerCase()}`,
    "  - world-brain",
    "---",
    "",
    `# ${ticker} — Knowledge Hub`,
    "",
    `> ${sector ?? "Uncategorized"} · Last updated ${today}`,
    "",
    sections.join("\n"),
    `_Last updated: ${today}_`,
    "",
  ].join("\n");

  await store.write(`${ticker}.md`, content);
  debug("learn", `Updated knowledge file for ${ticker}`);
}

export async function runMetaReflection(
  sessionResult: AgentRunResult,
  store: VaultStore,
  profiles: Record<string, { sector?: string }>
): Promise<void> {
  if (sessionResult.tickerResults.length === 0) return;

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

  // Inject the most recent prior session's insights so META-ANALYST can compare
  let priorInsightsBlock = "";
  try {
    const priorFiles = (await store.list("_insights"))
      .filter((f) => f.endsWith(".md") && !f.startsWith(today))
      .sort()
      .reverse();
    if (priorFiles.length > 0) {
      const raw = await store.read(`_insights/${priorFiles[0]}`);
      if (raw) {
        const body = raw.replace(/^---[\s\S]*?---\n/, "").trim();
        if (body) {
          priorInsightsBlock = `\n\nPrevious session insights (for comparison — do not repeat, only reference if relevant):\n${body.slice(0, 600)}`;
        }
      }
    }
  } catch { /* prior insights are optional */ }

  // Inject macro context (VIX, 10Y, DXY with week-over-week changes)
  let macroBlock = "";
  try {
    const macro = await getMacroSnapshot();
    macroBlock = `\n\nCurrent macro backdrop:\n${macro.summary}\nRegime: ${macro.regime}`;
  } catch { /* macro data is optional */ }

  const userMessage =
    `Synthesize cross-ticker and macro patterns from today's analysis session.\n\n` +
    sessionSummary +
    macroBlock +
    priorInsightsBlock +
    `\n\nWrite 3-6 sentences addressing:\n` +
    `(1) The dominant macro or geopolitical theme driving signals across multiple tickers today — reference specific macro indicators (VIX, 10Y, DXY) and their week-over-week changes if provided\n` +
    `(2) Cross-sector correlations — which sectors moved together or in opposition\n` +
    `(3) Signal calibration — what confidence levels appeared for which catalyst types, and whether today's calibration shifted from prior sessions\n` +
    `(4) The single most important anomaly or contradiction to monitor — make a specific, testable prediction if possible\n\n` +
    `Output only plain prose. No headers, no lists, no JSON.`;

  const reflection = await callLlm(getSubagentPrompt("META-ANALYST.md"), userMessage);
  if (!reflection) {
    debug("learn", "Meta-reflection returned empty — skipping insights update.");
    return;
  }

  // Write to _insights/YYYY-MM-DD.md — one file per session
  const tickers = sessionResult.tickerResults.map((t) => t.ticker).join(", ");
  const content = [
    "---",
    `date: "${today}"`,
    "type: session-insight",
    `tickers: "${tickers}"`,
    `totalBuys: ${sessionResult.totalBuys}`,
    `totalSells: ${sessionResult.totalSells}`,
    `totalHolds: ${sessionResult.totalHolds}`,
    "tags:",
    "  - insight",
    "  - world-brain",
    "---",
    "",
    `# Session Insights — ${today}`,
    "",
    reflection.trim(),
    "",
  ].join("\n");

  await store.write(`_insights/${today}.md`, content);
  debug("learn", `Session insight written to _insights/${today}.md`);

  await appendVaultLog(store, {
    type: "insight",
    title: `Session insights synthesized for ${today}`,
    details: `Tickers: ${tickers}. Totals: ${sessionResult.totalBuys} BUY / ${sessionResult.totalSells} SELL / ${sessionResult.totalHolds} HOLD.`,
  });

  invalidateSystemPromptCache();
}

export async function runLearningPass(
  sessionResult: AgentRunResult,
  store: VaultStore,
  profiles: Record<string, { sector?: string }>
): Promise<void> {
  if (sessionResult.tickerResults.length === 0) return;

  debug("learn", `Starting learning pass for ${sessionResult.tickerResults.length} tickers...`);

  for (const tr of sessionResult.tickerResults) {
    const sector = profiles[tr.ticker]?.sector;
    await updateTickerKnowledgeFile(tr.ticker, store, sector);
  }

  await runMetaReflection(sessionResult, store, profiles);

  const tickers = sessionResult.tickerResults.map((tr) => tr.ticker);
  await runGraphPass(store, profiles, tickers);

  debug("learn", "Learning pass complete.");
}