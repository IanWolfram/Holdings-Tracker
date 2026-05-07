import fs from "fs";
import path from "path";
import { callMlxRaw, invalidateSystemPromptCache } from "./brain";
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
import type { VaultStore } from "../lib/vault/store";

export interface VaultStory {
  headline: string;
  verdict: string;
  confidence: number;
  reason: string;
  date: string;
}

// This reads source code files from world-brain/agents/, NOT vault data.
// Keep using fs directly — these are code files, not vault notes.
function getSubagentPrompt(filename: string): string {
  try {
    const dir = path.join(process.cwd(), "world-brain", "agents");
    return fs.readFileSync(path.join(dir, filename), "utf-8").trim();
  } catch (err) {
    console.error(`[learn] Failed to read subagent prompt ${filename}:`, err);
    return "";
  }
}

// Stories with decay below this threshold are treated as stale and excluded
// from the few-shot context the brain sees on each new analysis. Roughly
// equivalent to "older than ~3 weeks": exp(-21/7) ≈ 0.05.
const STALE_DECAY_THRESHOLD = 0.05;

export async function getRecentVaultStories(
  store: VaultStore,
  ticker: string,
  limit: number = 3
): Promise<VaultStory[]> {
  try {
    const notes = await store.listNotes("news/");
    const nowMs = Date.now();
    const results: VaultStory[] = [];

    // Sort by date descending (most recent first)
    const sorted = notes
      .filter((n) => n.path.endsWith(".md"))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    for (const note of sorted) {
      if (results.length >= limit) break;
      try {
        const fm = note.frontmatter;
        const tickerFm = (fm.ticker as string | undefined)?.toUpperCase();
        if (tickerFm !== ticker.toUpperCase()) continue;
        const verdict = fm.verdict as string | undefined;
        if (!verdict || !["BUY", "SELL", "HOLD"].includes(verdict)) continue;
        if (fm.analysisFailed === "true" || fm.analysisFailed === true) continue;

        // Prefer the stored decayScore; fall back to computing from date
        let decayScore = parseFloat(String(fm.decayScore ?? ""));
        if (!Number.isFinite(decayScore)) {
          const dateStr = (fm.date as string | undefined) ?? note.path.split("/").pop()?.slice(0, 10) ?? "";
          const ts = Date.parse(`${dateStr}T16:00:00Z`);
          if (Number.isFinite(ts)) {
            const ageDays = Math.max(0, (nowMs - ts) / 86_400_000);
            decayScore = Math.exp(-ageDays / 7);
          } else {
            decayScore = 1;
          }
        }
        if (decayScore < STALE_DECAY_THRESHOLD) continue;

        const reason = (note.body ?? "")
          .match(/## AI Analysis\n([\s\S]*?)(?:\n##|$)/)?.[1]?.trim()
          ?.replace(/_No analysis available\._/g, "")
          .trim();
        if (!reason) continue;

        const headline =
          (note.body ?? "").match(/^# (.+)$/m)?.[1]?.trim() ??
          note.path.split("/").pop() ??
          "";
        results.push({
          headline,
          verdict,
          confidence: parseFloat(String(fm.confidence ?? "0.5")) || 0.5,
          reason,
          date: (fm.date as string | undefined) ?? note.path.split("/").pop()?.slice(0, 10) ?? "",
        });
      } catch {
        /* skip unreadable notes */
      }
    }
    return results;
  } catch {
    return [];
  }
}

export async function buildTickerKnowledge(
  store: VaultStore,
  ticker: string,
  sector?: string,
  limit: number = 30
): Promise<string> {
  const stories = await getRecentVaultStories(store, ticker, limit);
  if (stories.length === 0) return "";

  const storyList = stories
    .map((s, i) =>
      `${i + 1}. [${s.date}] ${s.verdict} (${Math.round(s.confidence * 100)}%) — "${s.headline.slice(0, 100)}"\n   Reason: ${s.reason.slice(0, 150)}`
    )
    .join("\n\n");

  // Include resolved prediction history for self-calibration
  let calibrationBlock = "";
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

  const result = await callMlxRaw(getSubagentPrompt("ARCHIVIST.md"), userMessage);
  return result;
}

export async function updateTickerKnowledgeFile(
  store: VaultStore,
  ticker: string,
  sector?: string
): Promise<void> {
  const synthesis = await buildTickerKnowledge(store, ticker, sector);
  if (!synthesis) {
    console.log(`[learn] No vault stories for ${ticker}, skipping knowledge update.`);
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

  const frontmatter: Record<string, unknown> = {
    date: today,
    type: "ticker-knowledge",
    ticker,
    ...(sector ? { sector } : {}),
    generated: true,
    tags: ["ticker-hub", ticker.toLowerCase(), "world-brain"],
  };

  const body = [
    `# ${ticker} — Knowledge Hub`,
    "",
    `> ${sector ?? "Uncategorized"} · Last updated ${today}`,
    "",
    sections.join("\n"),
    `_Last updated: ${today}_`,
    "",
  ].join("\n");

  await store.write(`${ticker}.md`, body, frontmatter);
  console.log(`[learn] Updated knowledge file for ${ticker}`);
}

export async function runMetaReflection(
  store: VaultStore,
  sessionResult: AgentRunResult,
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
    const insights = await store.listNotes("_insights/");
    const priorNotes = insights
      .filter((n) => n.path.endsWith(".md") && !n.path.includes(today))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    if (priorNotes.length > 0) {
      const priorNote = priorNotes[0];
      const body = (priorNote.body ?? "").trim();
      if (body) {
        priorInsightsBlock = `\n\nPrevious session insights (for comparison — do not repeat, only reference if relevant):\n${body.slice(0, 600)}`;
      }
    }
  } catch {
    /* prior insights are optional */
  }

  // Inject macro context (VIX, 10Y, DXY with week-over-week changes)
  let macroBlock = "";
  try {
    const macro = await getMacroSnapshot();
    macroBlock = `\n\nCurrent macro backdrop:\n${macro.summary}\nRegime: ${macro.regime}`;
  } catch {
    /* macro data is optional */
  }

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

  const reflection = await callMlxRaw(getSubagentPrompt("META-ANALYST.md"), userMessage);
  if (!reflection) {
    console.log("[learn] Meta-reflection returned empty — skipping insights update.");
    return;
  }

  // Write to _insights/YYYY-MM-DD.md — one file per session
  const tickers = sessionResult.tickerResults.map((t) => t.ticker).join(", ");
  const frontmatter: Record<string, unknown> = {
    date: today,
    type: "session-insight",
    tickers,
    totalBuys: sessionResult.totalBuys,
    totalSells: sessionResult.totalSells,
    totalHolds: sessionResult.totalHolds,
    tags: ["insight", "world-brain"],
  };

  const body = [
    `# Session Insights — ${today}`,
    "",
    reflection.trim(),
    "",
  ].join("\n");

  await store.write(`_insights/${today}.md`, body, frontmatter);
  console.log(`[learn] Session insight written to _insights/${today}.md`);

  await appendVaultLog(store, {
    type: "insight",
    title: `Session insights synthesized for ${today}`,
    details: `Tickers: ${tickers}. Totals: ${sessionResult.totalBuys} BUY / ${sessionResult.totalSells} SELL / ${sessionResult.totalHolds} HOLD.`,
  });

  invalidateSystemPromptCache();
}

export async function runLearningPass(
  store: VaultStore,
  sessionResult: AgentRunResult,
  profiles: Record<string, { sector?: string }>
): Promise<void> {
  if (sessionResult.tickerResults.length === 0) return;

  console.log(`[learn] Starting learning pass for ${sessionResult.tickerResults.length} tickers...`);

  for (const tr of sessionResult.tickerResults) {
    const sector = profiles[tr.ticker]?.sector;
    await updateTickerKnowledgeFile(store, tr.ticker, sector);
  }

  await runMetaReflection(store, sessionResult, profiles);

  const tickers = sessionResult.tickerResults.map((tr) => tr.ticker);
  await runGraphPass(store, profiles, tickers);

  console.log("[learn] Learning pass complete.");
}