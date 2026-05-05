import fs from "fs";
import path from "path";
import { resolveVaultPath } from "../lib/constants";

// ---------------------------------------------------------------------------
// Agent context — split into system prompt and rules for /api/chat
// ---------------------------------------------------------------------------

let systemPrompt: string | null = null;

export function invalidateSystemPromptCache(): void {
  systemPrompt = null;
}

export function getSystemPrompt(): string {
  if (!systemPrompt) {
    const dir = path.join(process.cwd(), "world-brain");
    const agentsDir = path.join(dir, "agents");

    const baseParts = [
      { name: "AGENT.md", path: path.join(agentsDir, "AGENT.md") },
      { name: "sector-rules.md", path: path.join(dir, "sector-rules.md") }
    ].map((f) => {
        try { return fs.readFileSync(f.path, "utf-8"); } catch { return ""; }
      })
      .filter(Boolean);

    // Load the N most recent session insights from the vault (_insights/ dir)
    // instead of the old monolithic market-insights.md, to keep the prompt lean.
    let insightsBlock = "";
    try {
      const vaultPath = process.env.WORLD_VAULT_PATH;
      if (vaultPath) {
        const resolved = resolveVaultPath(vaultPath);
        if (resolved) {
          const insightsDir = path.join(resolved, "_insights");
          if (fs.existsSync(insightsDir)) {
            const files = fs
              .readdirSync(insightsDir)
              .filter((f: string) => f.endsWith(".md"))
              .sort()
              .reverse()
              .slice(0, 3); // only the 3 most recent sessions
            const snippets = files
              .map((f: string) => {
                try {
                  const raw = fs.readFileSync(path.join(insightsDir, f), "utf-8");
                  // Strip frontmatter
                  return raw.replace(/^---[\s\S]*?---\n/, "").trim();
                } catch { return ""; }
              })
              .filter(Boolean);
            if (snippets.length > 0) {
              insightsBlock =
                `\n\n---\n\n## Recent Session Insights (last ${snippets.length} sessions)\n\n` +
                snippets.join("\n\n---\n\n");
            }
          }
        }
      }
    } catch { /* insights are optional */ }

    const runtimeContextGuide =
      "\n\n---\n\n## Runtime Context Usage\n" +
      "When the user message includes Market State or Focal Ticker State blocks, incorporate those signals into confidence calibration and reasoning.\n" +
      "Treat macro context as a modifier, not an automatic override.";

    systemPrompt = baseParts.join("\n\n---\n\n") + insightsBlock + runtimeContextGuide;
  }
  return systemPrompt;
}

export interface UnifiedAnalysis {
  verdict: Verdict;
  confidence: number;
  reason: string;
  sectorTags: string[];
  affectedTickers: string[];
  originCountryCode: string | null;
  relevanceScore: number;
  geoSummary: string;
  analysisFailed: boolean;
}

export interface StoryMacroContext {
  vix: number | null;
  tenY: number | null;
  dxy: number | null;
  regime: string;
  summary?: string;
}

export interface StoryTickerStateContext {
  price: number;
  change1d: number | null;
  change5d: number | null;
  change30d: number | null;
  return52wHigh: number | null;
  rsi14: number | null;
  atr14: number | null;
}

export interface StoryMarketContext {
  macro?: StoryMacroContext;
  tickerState?: StoryTickerStateContext;
}

// ---------------------------------------------------------------------------
// Helper: strip DeepSeek-R1 chain-of-thought blocks.
// ---------------------------------------------------------------------------

function stripThink(raw: string): string {
  let stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const closeIdx = stripped.lastIndexOf("</think>");
  if (closeIdx !== -1) {
    stripped = stripped.slice(closeIdx + "</think>".length).trim();
  }
  return stripped;
}

// ---------------------------------------------------------------------------
// SSE streaming helper — shared by both MLX and DeepSeek paths
// ---------------------------------------------------------------------------

async function consumeStream(
  res: Response,
  onChunk?: (text: string) => void
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder("utf-8");
  let accumulated = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (let line of lines) {
      line = line.trim();
      if (!line.startsWith("data: ")) continue;
      const dataStr = line.slice(6).trim();
      if (dataStr === "[DONE]" || !dataStr) continue;
      try {
        const parsed = JSON.parse(dataStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          accumulated += content;
          onChunk?.(accumulated);
        }
      } catch { /* ignore partial chunks */ }
    }
  }
  return accumulated;
}

// ---------------------------------------------------------------------------
// Internal MLX implementation
// ---------------------------------------------------------------------------

import type { Verdict } from "@/types/news.types";
import { getActiveModel, getModelKey } from "../lib/ai-config";
import { isAiHealthy } from "../lib/ai-health";
import { withInferenceSemaphore, withCloudSemaphore } from "../lib/classifier";
import { WORLD_VAULT_PATH } from "../lib/constants";
import { buildCalibrationBlock } from "./calibration";

// ---------------------------------------------------------------------------
// Analysis failure counters (exported for observability)
// ---------------------------------------------------------------------------

export const analysisStats = {
  total: 0,
  succeeded: 0,
  failed: 0,
  retried: 0,
};

// ---------------------------------------------------------------------------
// Correlated holdings — read _graph/correlations.json and surface top peers.
// ---------------------------------------------------------------------------

interface CorrelationReportShape {
  matrix?: Record<string, Record<string, number>>;
  tickers?: string[];
}

let correlationCache: { data: CorrelationReportShape | null; mtimeMs: number; expiresAt: number } | null = null;
const CORRELATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function loadCorrelationReport(): CorrelationReportShape | null {
  if (!WORLD_VAULT_PATH) return null;
  const resolved = resolveVaultPath(WORLD_VAULT_PATH);
  if (!resolved) return null;
  const corrPath = path.join(resolved, "_graph", "correlations.json");
  let stat: fs.Stats;
  try {
    stat = fs.statSync(corrPath);
  } catch {
    return null;
  }
  if (correlationCache && correlationCache.mtimeMs === stat.mtimeMs && Date.now() < correlationCache.expiresAt) {
    return correlationCache.data;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(corrPath, "utf-8")) as CorrelationReportShape;
    correlationCache = { data: parsed, mtimeMs: stat.mtimeMs, expiresAt: Date.now() + CORRELATION_CACHE_TTL_MS };
    return parsed;
  } catch {
    correlationCache = { data: null, mtimeMs: stat.mtimeMs, expiresAt: Date.now() + CORRELATION_CACHE_TTL_MS };
    return null;
  }
}

function findRecentVerdictForTicker(
  ticker: string
): { verdict: string; confidence: number; date: string } | null {
  if (!WORLD_VAULT_PATH) return null;
  const resolved = resolveVaultPath(WORLD_VAULT_PATH);
  if (!resolved) return null;
  const newsDir = path.join(resolved, "news");
  let entries: string[];
  try {
    entries = fs.readdirSync(newsDir).filter((f) => f.endsWith(".md")).sort().reverse();
  } catch {
    return null;
  }
  const upper = ticker.toUpperCase();
  for (const file of entries.slice(0, 200)) {
    try {
      const content = fs.readFileSync(path.join(newsDir, file), "utf-8");
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
      if (fm.ticker?.toUpperCase() !== upper) continue;
      if (!fm.verdict || !["BUY", "SELL", "HOLD"].includes(fm.verdict)) continue;
      if (fm.analysisFailed === "true") continue;
      if (fm.confidence === "0.50" && fm.verdict === "HOLD" && fm.analysisFailed !== "false") continue;
      const confidence = parseFloat(fm.confidence ?? "0.5") || 0.5;
      return { verdict: fm.verdict, confidence, date: fm.date ?? file.slice(0, 10) };
    } catch {
      /* skip unreadable */
    }
  }
  return null;
}

interface CorrelatedPeer {
  ticker: string;
  corr: number;
  verdict?: string;
  confidence?: number;
  date?: string;
}

function buildCorrelatedHoldingsBlock(focalTicker: string, holdingTickers: string[]): string {
  const report = loadCorrelationReport();
  if (!report?.matrix) return "";
  const focal = focalTicker.toUpperCase();
  const focalRow = report.matrix[focal];
  if (!focalRow) return "";

  const candidates: CorrelatedPeer[] = [];
  const holdingSet = new Set(holdingTickers.map((t) => t.toUpperCase()));
  for (const [peer, corr] of Object.entries(focalRow)) {
    if (peer === focal) continue;
    if (typeof corr !== "number" || !Number.isFinite(corr)) continue;
    if (Math.abs(corr) < 0.4) continue;
    if (holdingSet.size > 0 && !holdingSet.has(peer)) continue;
    candidates.push({ ticker: peer, corr });
  }
  if (candidates.length === 0) return "";

  candidates.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
  const top = candidates.slice(0, 3);
  for (const peer of top) {
    const recent = findRecentVerdictForTicker(peer.ticker);
    if (recent) {
      peer.verdict = recent.verdict;
      peer.confidence = recent.confidence;
      peer.date = recent.date;
    }
  }

  const lines = ["## Correlated Holdings"];
  for (const p of top) {
    const verdictBit = p.verdict
      ? `last verdict ${p.verdict} ${Math.round((p.confidence ?? 0) * 100)}% (${p.date ?? "n/a"})`
      : "no recent verdict in vault";
    lines.push(`- ${p.ticker} (corr ${p.corr.toFixed(2)}) — ${verdictBit}`);
  }
  return `\n\n${lines.join("\n")}`;
}

export function invalidateCorrelationCache(): void {
  correlationCache = null;
}

async function callMlxRawInternal(systemPromptText: string, userMessage: string, retries = 2): Promise<string> {
  const baseUrl = process.env.MLX_BASE_URL ?? "http://localhost:8080/v1";
  const model = process.env.MLX_MODEL ?? "mlx-community/DeepSeek-R1-Distill-Qwen-14B-4bit";

  if (!(await isAiHealthy("mlx", baseUrl))) return "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const raw = await withInferenceSemaphore(async () => {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPromptText },
              { role: "user", content: userMessage },
            ],
            temperature: 0.3,
            max_tokens: 1024,
            stream: true,
          }),
          signal: AbortSignal.timeout(300_000),
        });
        if (!res.ok) throw new Error(`MLX HTTP ${res.status}`);
        return consumeStream(res);
      });
      return stripThink(raw);
    } catch (err) {
      if (attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`[brain] MLX call failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`, err);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error("[brain] callMlxRawInternal error after retries:", err);
      }
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Internal DeepSeek API implementation
// ---------------------------------------------------------------------------

async function callDeepSeekRawInternal(
  systemPromptText: string,
  userMessage: string,
  onChunk?: (text: string) => void,
  modelOverride?: string,
  apiKeyOverride?: string,
  baseUrlOverride?: string,
  retries = 2
): Promise<string> {
  const apiKey = apiKeyOverride ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[brain] API model selected but no key configured.");
    return "";
  }

  const model = modelOverride ?? "deepseek-chat";
  const baseUrl = baseUrlOverride ?? "https://api.deepseek.com/v1";

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPromptText },
            { role: "user", content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 2048,
          stream: true,
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt < retries) {
          const delay = 1000 * Math.pow(2, attempt);
          console.warn(`[brain] DeepSeek HTTP ${res.status} (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new Error(`DeepSeek HTTP ${res.status}: ${errText}`);
      }
      const raw = await consumeStream(res, onChunk);
      return stripThink(raw);
    } catch (err) {
      if (attempt < retries && !(err instanceof Error && err.message.startsWith("DeepSeek HTTP"))) {
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(`[brain] DeepSeek call failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`, err);
        await new Promise((r) => setTimeout(r, delay));
      } else if (attempt >= retries) {
        console.error("[brain] callDeepSeekRawInternal error after retries:", err);
      }
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Public router — callMlxRaw routes to whichever engine is active.
// Called by learn.ts (ARCHIVIST + META-ANALYST subagents).
// ---------------------------------------------------------------------------

export async function callMlxRaw(systemPromptText: string, userMessage: string): Promise<string> {
  const active = getActiveModel();
  if (active.provider === "deepseek" || active.provider === "openai") {
    const apiKey = getModelKey(active.id);
    const baseUrl = active.provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com/v1";
    return withCloudSemaphore(() =>
      callDeepSeekRawInternal(systemPromptText, userMessage, undefined, active.model, apiKey, baseUrl)
    );
  }
  return callMlxRawInternal(systemPromptText, userMessage);
}

function formatSignedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
}

function buildMarketContextBlock(context?: StoryMarketContext): string {
  if (!context) return "";

  const lines: string[] = [];
  if (context.macro) {
    lines.push("## Market State");
    lines.push(
      `VIX: ${formatNumber(context.macro.vix)} | 10Y: ${formatNumber(context.macro.tenY)}% | DXY: ${formatNumber(context.macro.dxy)} | Regime: ${context.macro.regime}`
    );
    if (context.macro.summary) {
      lines.push(`Macro note: ${context.macro.summary}`);
    }
  }

  if (context.tickerState) {
    if (lines.length > 0) lines.push("");
    lines.push("## Focal Ticker State");
    lines.push(
      `Price: $${context.tickerState.price.toFixed(2)} | 1d: ${formatSignedPercent(context.tickerState.change1d)} | 5d: ${formatSignedPercent(context.tickerState.change5d)} | 30d: ${formatSignedPercent(context.tickerState.change30d)}`
    );
    lines.push(
      `From 52w high: ${formatSignedPercent(context.tickerState.return52wHigh)} | RSI14: ${formatNumber(context.tickerState.rsi14)} | ATR14: ${formatNumber(context.tickerState.atr14, 4)}`
    );
  }

  if (lines.length === 0) return "";
  return `\n\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Main inference — analyzeStory routes based on active engine
// ---------------------------------------------------------------------------

export async function analyzeStory(
  ticker: string,
  headline: string,
  summary: string,
  holdingTickers: string[] = [],
  holdingSectors: string[] = [],
  onStream?: (text: string) => void,
  tickerContext?: string,
  recentVerdicts?: Array<{ headline: string; verdict: string; confidence: number; reason: string }>,
  marketContext?: StoryMarketContext
): Promise<UnifiedAnalysis> {
  analysisStats.total++;
  const active = getActiveModel();
  const activeApiKey = active.provider === "deepseek" ? getModelKey(active.id) : undefined;

  if (active.provider === "deepseek" || active.provider === "openai") {
    if (!activeApiKey) {
      console.warn(`[brain] Model "${active.name}" has no API key — falling back.`);
      analysisStats.failed++;
      return fallbackAnalysis(undefined, ticker, headline, summary);
    }
  } else {
    const baseUrl = process.env.MLX_BASE_URL ?? "http://localhost:8080/v1";
    if (!(await isAiHealthy("mlx", baseUrl))) {
      console.warn(`[brain] MLX engine at ${baseUrl} is not responding.`);
      analysisStats.failed++;
      return fallbackAnalysis(undefined, ticker, headline, summary);
    }
  }

  const holdingsBlock = holdingTickers.length > 0
    ? `Holdings context:\nTickers: ${holdingTickers.join(", ")}\nSectors: ${[...new Set(holdingSectors)].join(", ")}`
    : `Focal ticker: ${ticker}`;

  const tickerContextBlock = tickerContext
    ? `\n\nTicker Knowledge:\n${tickerContext.slice(0, 400)}`
    : "";

  const fewShotBlock = recentVerdicts && recentVerdicts.length > 0
    ? "\n\nRecent verdicts for this ticker (for calibration only):\n" +
      recentVerdicts.map(v =>
        `- "${v.headline.slice(0, 80)}" → ${v.verdict} (${Math.round(v.confidence * 100)}%): ${v.reason.slice(0, 120)}`
      ).join("\n")
    : "";

  const marketContextBlock = buildMarketContextBlock(marketContext);
  const calibrationBlock = WORLD_VAULT_PATH
    ? buildCalibrationBlock(ticker, WORLD_VAULT_PATH)
    : "";
  const correlatedBlock = buildCorrelatedHoldingsBlock(ticker, holdingTickers);

  const userMessage =
    `${holdingsBlock}\n\n` +
    `Focal ticker: ${ticker}` +
    tickerContextBlock +
    fewShotBlock +
    marketContextBlock +
    calibrationBlock +
    correlatedBlock +
    `\n\nHeadline: ${headline}\n` +
    `Summary: ${summary || "(no summary)"}\n\n` +
    `OUTPUT ONLY THE JSON OBJECT. NO MARKDOWN. NO EXPLANATION. START WITH { AND END WITH }.`;

  // Token-budget logging — log when prompt gets uncomfortably large.
  // Rough heuristic: ~4 chars/token. 8k context model → ~32k char budget;
  // log when user message alone exceeds 6k tokens (~24k chars / 75% of floor).
  const approxTokens = Math.round(userMessage.length / 4);
  if (approxTokens > 6_000) {
    console.warn(
      `[brain] Large user message for ${ticker}: ${userMessage.length} chars (~${approxTokens} tokens). Consider truncating context blocks.`
    );
  }

  let raw = "";
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (active.provider === "deepseek" || active.provider === "openai") {
        const baseUrl = active.provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com/v1";
        raw = await withCloudSemaphore(() =>
          callDeepSeekRawInternal(getSystemPrompt(), userMessage, onStream, active.model, activeApiKey, baseUrl)
        );
      } else {
        raw = await withInferenceSemaphore(async () => {
          const baseUrl = process.env.MLX_BASE_URL ?? "http://localhost:8080/v1";
          const model = process.env.MLX_MODEL ?? "mlx-community/DeepSeek-R1-Distill-Qwen-14B-4bit";

          const res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: getSystemPrompt() },
                { role: "user", content: userMessage },
              ],
              temperature: 0.3,
              max_tokens: 2048,
              stream: true,
            }),
            signal: AbortSignal.timeout(300_000),
          });
          if (!res.ok) throw new Error(`MLX HTTP ${res.status}`);
          return consumeStream(res, onStream);
        });
      }
      if (raw) break;
      console.warn(`[brain] Empty response for ${ticker} (attempt ${attempt + 1}/${MAX_RETRIES})`);
    } catch (err) {
      console.error(`[brain] inference error (attempt ${attempt + 1}/${MAX_RETRIES}):`, err);
    }
    if (attempt < MAX_RETRIES - 1) {
      analysisStats.retried++;
      const delay = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  if (!raw) {
    analysisStats.failed++;
    return fallbackAnalysis(undefined, ticker, headline, summary);
  }

  try {
    const cleaned = stripThink(raw);

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    let jsonStr = "";
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
    } else {
      const fence = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      jsonStr = fence?.[1] ?? "";
    }

    if (!jsonStr) {
      console.warn(`[brain] No JSON found in response for ${headline}.`);
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonStr) as {
      verdict?: string;
      confidence?: number;
      reason?: string;
      sector_tags?: string[];
      affected_tickers?: string[];
      origin_country_code?: string | null;
      relevance_score?: number;
      geo_summary?: string;
    };

    const verdict = (["BUY", "SELL", "HOLD"].includes(parsed.verdict ?? "")
      ? parsed.verdict
      : "HOLD") as Verdict;

    analysisStats.succeeded++;
    return {
      verdict,
      confidence: typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      reason: parsed.reason ?? headline,
      sectorTags: Array.isArray(parsed.sector_tags) ? parsed.sector_tags : [],
      affectedTickers: (Array.isArray(parsed.affected_tickers) ? parsed.affected_tickers : [])
        .filter((t) => holdingTickers.length === 0 || holdingTickers.includes(t)),
      originCountryCode: typeof parsed.origin_country_code === "string"
        ? parsed.origin_country_code : null,
      relevanceScore: typeof parsed.relevance_score === "number"
        ? Math.max(0, Math.min(1, parsed.relevance_score)) : computeHeuristicRelevance(ticker, headline, summary ?? ""),
      geoSummary: parsed.geo_summary ?? "",
      analysisFailed: false,
    };
  } catch {
    console.error("[brain] JSON parse failed, raw:", raw.slice(0, 200));
    analysisStats.failed++;
    return fallbackAnalysis(undefined, ticker, headline, summary);
  }
}

function computeHeuristicRelevance(ticker: string, headline: string, summary: string): number {
  const upper = ticker.toUpperCase();
  const headlineUpper = headline.toUpperCase();
  const summaryUpper = (summary ?? "").toUpperCase();
  if (headlineUpper.includes(upper)) return 0.85;
  if (summaryUpper.includes(upper)) return 0.65;
  return 0.3;
}

function fallbackAnalysis(reason?: string, ticker?: string, headline?: string, summary?: string): UnifiedAnalysis {
  const baseReason = reason ?? "Analysis unavailable — defaulting to HOLD.";
  return {
    verdict: "HOLD",
    confidence: 0.5,
    reason: `FALLBACK: ${baseReason}`,
    sectorTags: [],
    affectedTickers: [],
    originCountryCode: null,
    relevanceScore: ticker ? computeHeuristicRelevance(ticker, headline ?? "", summary ?? "") : 0,
    geoSummary: "",
    analysisFailed: true,
  };
}
