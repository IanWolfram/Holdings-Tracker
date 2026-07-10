import fs from "fs";
import path from "path";
import { FALLBACK_CONFIDENCE } from "../lib/constants";

// ---------------------------------------------------------------------------
// Agent context — split into system prompt and rules for /api/chat
// ---------------------------------------------------------------------------

// Memoizes ONLY the portfolio-agnostic static base (files + runtime guide). Per-user
// content (session insights) is NEVER cached here — it is passed in per call. Caching
// any per-user data in a process-wide var leaks one user's data to every other user.
let staticSystemBase: string | null = null;

/**
 * Load the recent session-insights block for a specific user's vault. Returns a
 * string to be passed into getSystemPrompt() per call (NOT cached globally), so a
 * concurrent multi-tenant process never serves one user's insights to another.
 */
export async function loadSessionInsights(store: VaultStore): Promise<string> {
  try {
    const files = (await store.list("_insights"))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, 3);
    const snippets: string[] = [];
    for (const file of files) {
      const raw = await store.read(`_insights/${file}`);
      if (raw) {
        snippets.push(raw.replace(/^---[\s\S]*?---\n/, "").trim());
      }
    }
    if (snippets.length > 0) {
      return (
        `\n\n---\n\n## Recent Session Insights (last ${snippets.length} sessions)\n\n` +
        snippets.join("\n\n---\n\n")
      );
    }
  } catch { /* insights are optional */ }
  return "";
}

export function invalidateSystemPromptCache(): void {
  staticSystemBase = null;
}

function getStaticSystemBase(): string {
  if (staticSystemBase === null) {
    const dir = path.join(process.cwd(), "world-brain");
    const agentsDir = path.join(dir, "agents");

    // Portfolio-agnostic only — never embed a specific user's tickers here, or the
    // memo would leak one user's portfolio to every other user. Per-user personalization
    // lives in the user message (Holdings context block) and the market digest.
    // (world-brain/supply-chain.md is portfolio-specific and deliberately NOT loaded —
    //  it is consumed only by the graph renderer in graph.ts.)
    const baseParts = [
      { name: "AGENT.md", path: path.join(agentsDir, "AGENT.md") },
      { name: "verdict-policy.md", path: path.join(dir, "verdict-policy.md") },
      { name: "sector-playbook.md", path: path.join(dir, "sector-playbook.md") },
    ].map((f) => {
        try { return fs.readFileSync(f.path, "utf-8"); } catch { return ""; }
      })
      .filter(Boolean);

    const runtimeContextGuide =
      "\n\n---\n\n## Runtime Context Usage\n" +
      "When the user message includes Market State or Focal Ticker State blocks, incorporate those signals into confidence calibration and reasoning.\n" +
      "Treat macro context as a modifier, not an automatic override.";

    staticSystemBase = baseParts.join("\n\n---\n\n") + runtimeContextGuide;
  }
  return staticSystemBase;
}

/**
 * Build the system prompt. The static base is portfolio-agnostic and memoized;
 * per-user session insights (if any) must be passed in by the caller — they are
 * appended per call and never cached, keeping the prompt safe for multi-tenant use.
 */
export function getSystemPrompt(sessionInsights = ""): string {
  return getStaticSystemBase() + sessionInsights;
}

export interface UnifiedAnalysis {
  verdict: Verdict;
  confidence: number;
  /** Neutral 1–2 sentence factual recap of the article, generated from supplied text. Empty when the source text is too thin to summarize. */
  summary: string;
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
// SSE streaming helper
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

import type { Verdict } from "@/types/news.types";
import { getActiveModel, getModelKey } from "../lib/ai-config";
import type { VaultStore } from "@/lib/vault/store";
import { withCloudSemaphore } from "../lib/classifier";
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

// Keyed by the vault store instance (WeakMap) so each user's correlations are
// cached independently — a process-wide single-slot cache would serve the first
// user's correlations to every other user. WeakMap auto-evicts when the per-sweep
// store is GC'd.
let correlationCache = new WeakMap<VaultStore, { data: CorrelationReportShape | null; expiresAt: number }>();
const CORRELATION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadCorrelationReport(store?: VaultStore): Promise<CorrelationReportShape | null> {
  if (!store) return null;
  const cached = correlationCache.get(store);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }
  try {
    const content = await store.read("_graph/correlations.json");
    if (content === null) return null;
    const parsed = JSON.parse(content) as CorrelationReportShape;
    correlationCache.set(store, { data: parsed, expiresAt: Date.now() + CORRELATION_CACHE_TTL_MS });
    return parsed;
  } catch {
    correlationCache.set(store, { data: null, expiresAt: Date.now() + CORRELATION_CACHE_TTL_MS });
    return null;
  }
}

async function findRecentVerdictForTicker(
  ticker: string,
  store?: VaultStore
): Promise<{ verdict: string; confidence: number; date: string } | null> {
  if (!store) return null;
  const upper = ticker.toUpperCase();
  try {
    const files = (await store.list("news"))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, 200);
    for (const file of files) {
      try {
        const content = await store.read(`news/${file}`);
        if (content === null) continue;
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
        const confidence = parseFloat(fm.confidence ?? String(FALLBACK_CONFIDENCE)) || FALLBACK_CONFIDENCE;
        return { verdict: fm.verdict, confidence, date: fm.date ?? file.slice(0, 10) };
      } catch {
        /* skip unreadable */
      }
    }
  } catch { /* store.list failed */ }
  return null;
}

interface CorrelatedPeer {
  ticker: string;
  corr: number;
  verdict?: string;
  confidence?: number;
  date?: string;
}

async function buildCorrelatedHoldingsBlock(focalTicker: string, holdingTickers: string[], store?: VaultStore): Promise<string> {
  const report = await loadCorrelationReport(store);
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
    const recent = await findRecentVerdictForTicker(peer.ticker, store);
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
  correlationCache = new WeakMap();
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
// Public LLM call — DeepSeek (or OpenAI when configured).
// Called by learn.ts (ARCHIVIST + META-ANALYST), catalyst-classifier, alerts, chat.
// ---------------------------------------------------------------------------

export async function callLlm(systemPromptText: string, userMessage: string): Promise<string> {
  const active = getActiveModel();
  const apiKey = getModelKey(active.id);
  const baseUrl = active.provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com/v1";
  return withCloudSemaphore(() =>
    callDeepSeekRawInternal(systemPromptText, userMessage, undefined, active.model, apiKey, baseUrl),
  );
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
  marketContext?: StoryMarketContext,
  store?: VaultStore,
  holdingSectorMap?: Record<string, string>,
  marketDigest?: string,
  sessionInsights?: string
): Promise<UnifiedAnalysis> {
  analysisStats.total++;
  const active = getActiveModel();
  const activeApiKey = getModelKey(active.id);

  if (!activeApiKey) {
    console.warn(`[brain] Model "${active.name}" has no API key — falling back.`);
    analysisStats.failed++;
    return fallbackAnalysis(undefined, ticker, headline, summary);
  }

  const holdingsBlock = holdingTickers.length > 0
    ? "Holdings context (this user's actual portfolio):\n" +
      (holdingSectorMap && Object.keys(holdingSectorMap).length > 0
        ? holdingTickers
            .map((t) => `- ${t}${holdingSectorMap[t.toUpperCase()] ? ` (${holdingSectorMap[t.toUpperCase()]})` : ""}`)
            .join("\n")
        : `Tickers: ${holdingTickers.join(", ")}\nSectors: ${[...new Set(holdingSectors)].join(", ")}`) +
      "\nApply the matching sector-playbook entry for the focal ticker's business model. " +
      "Only include tickers from this list in affected_tickers."
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
  const marketDigestBlock = marketDigest
    ? `\n\n## Market & Sector Context (portfolio-wide, context only)\n${marketDigest}`
    : "";
  const calibrationBlock = store
    ? await buildCalibrationBlock(ticker, store)
    : "";
  const correlatedBlock = await buildCorrelatedHoldingsBlock(ticker, holdingTickers, store);

  const userMessage =
    `${holdingsBlock}\n\n` +
    `Focal ticker: ${ticker}` +
    tickerContextBlock +
    fewShotBlock +
    marketContextBlock +
    marketDigestBlock +
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
  const baseUrl = active.provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com/v1";
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      raw = await withCloudSemaphore(() =>
        callDeepSeekRawInternal(getSystemPrompt(sessionInsights), userMessage, onStream, active.model, activeApiKey, baseUrl),
      );
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
      summary?: string;
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

    // Model-stated confidence, unmodified. An earlier revision shrank this with
    // getConfidenceReliabilityFactor — but that factor measures FORECAST outcomes,
    // not news-verdict accuracy, and the shrunk values (~0.2–0.35) fed downstream
    // into the forecaster prompt, whose FORECASTER.md thresholds (≥0.75 strong,
    // ≤0.60 noise) then read every verdict as noise and killed the news channel.
    // Confidence shrink belongs on the forecast output (lib/agent/forecast.ts),
    // the domain the calibration data actually measures.
    const rawConfidence = typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence)) : FALLBACK_CONFIDENCE;

    // Neutral article recap. Trim defensively and cap length so a misbehaving
    // model can never dump the full article back into the Summary block.
    const aiSummary = typeof parsed.summary === "string"
      ? parsed.summary.trim().slice(0, 600)
      : "";

    analysisStats.succeeded++;
    return {
      verdict,
      confidence: rawConfidence,
      summary: aiSummary,
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
    confidence: FALLBACK_CONFIDENCE,
    summary: "",
    reason: `FALLBACK: ${baseReason}`,
    sectorTags: [],
    affectedTickers: [],
    originCountryCode: null,
    relevanceScore: ticker ? computeHeuristicRelevance(ticker, headline ?? "", summary ?? "") : 0,
    geoSummary: "",
    analysisFailed: true,
  };
}
