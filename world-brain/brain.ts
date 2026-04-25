import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Agent context — split into system prompt and rules for /api/chat
// ---------------------------------------------------------------------------

let systemPrompt: string | null = null;

export function invalidateSystemPromptCache(): void {
  systemPrompt = null;
}

function getSystemPrompt(): string {
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

    let insightsBlock = "";
    try {
      const raw = fs.readFileSync(path.join(dir, "market-insights.md"), "utf-8");
      if (raw.trim()) {
        insightsBlock = `\n\n---\n\n## Accumulated Market Intelligence\n\n${raw.trim()}`;
      }
    } catch { /* file doesn't exist yet — that's fine */ }

    systemPrompt = baseParts.join("\n\n---\n\n") + insightsBlock;
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

import { withInferenceSemaphore } from "../lib/classifier";
import { isAiHealthy } from "../lib/ai-health";
import { getActiveModel, getModelKey } from "../lib/ai-config";
import type { Verdict } from "@/types/news.types";

async function callMlxRawInternal(systemPromptText: string, userMessage: string): Promise<string> {
  const baseUrl = process.env.MLX_BASE_URL ?? "http://localhost:8080/v1";
  const model = process.env.MLX_MODEL ?? "mlx-community/DeepSeek-R1-Distill-Qwen-14B-4bit";

  if (!(await isAiHealthy("mlx", baseUrl))) return "";

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
    console.error("[brain] callMlxRawInternal error:", err);
    return "";
  }
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
  baseUrlOverride?: string
): Promise<string> {
  const apiKey = apiKeyOverride ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[brain] API model selected but no key configured.");
    return "";
  }

  const model = modelOverride ?? "deepseek-chat";
  const baseUrl = baseUrlOverride ?? "https://api.deepseek.com/v1";

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
        max_tokens: 1024,
        stream: true,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`DeepSeek HTTP ${res.status}: ${errText}`);
    }
    const raw = await consumeStream(res, onChunk);
    return stripThink(raw);
  } catch (err) {
    console.error("[brain] callDeepSeekRawInternal error:", err);
    return "";
  }
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
    return callDeepSeekRawInternal(systemPromptText, userMessage, undefined, active.model, apiKey, baseUrl);
  }
  return callMlxRawInternal(systemPromptText, userMessage);
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
  recentVerdicts?: Array<{ headline: string; verdict: string; confidence: number; reason: string }>
): Promise<UnifiedAnalysis> {
  const active = getActiveModel();
  const activeApiKey = active.provider === "deepseek" ? getModelKey(active.id) : undefined;

  if (active.provider === "deepseek" || active.provider === "openai") {
    if (!activeApiKey) {
      console.warn(`[brain] Model "${active.name}" has no API key — falling back.`);
      return fallbackAnalysis();
    }
  } else {
    const baseUrl = process.env.MLX_BASE_URL ?? "http://localhost:8080/v1";
    if (!(await isAiHealthy("mlx", baseUrl))) {
      console.warn(`[brain] MLX engine at ${baseUrl} is not responding.`);
      return fallbackAnalysis();
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

  const userMessage =
    `${holdingsBlock}\n\n` +
    `Focal ticker: ${ticker}` +
    tickerContextBlock +
    fewShotBlock +
    `\n\nHeadline: ${headline}\n` +
    `Summary: ${summary || "(no summary)"}\n\n` +
    `OUTPUT ONLY THE JSON OBJECT. NO MARKDOWN. NO EXPLANATION. START WITH { AND END WITH }.`;

  let raw = "";
  try {
    if (active.provider === "deepseek" || active.provider === "openai") {
      const baseUrl = active.provider === "openai" ? "https://api.openai.com/v1" : "https://api.deepseek.com/v1";
      raw = await callDeepSeekRawInternal(getSystemPrompt(), userMessage, onStream, active.model, activeApiKey, baseUrl);
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
            temperature: 0.1,
            max_tokens: 4096,
            stream: true,
          }),
          signal: AbortSignal.timeout(300_000),
        });
        if (!res.ok) throw new Error(`MLX HTTP ${res.status}`);
        return consumeStream(res, onStream);
      });
    }
  } catch (err) {
    console.error(`[brain] inference error:`, err);
    return fallbackAnalysis();
  }

  try {
    let cleaned = stripThink(raw);

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
        ? Math.max(0, Math.min(1, parsed.relevance_score)) : 0,
      geoSummary: parsed.geo_summary ?? "",
    };
  } catch {
    console.error("[brain] JSON parse failed, raw:", raw.slice(0, 200));
    return fallbackAnalysis();
  }
}

function fallbackAnalysis(): UnifiedAnalysis {
  return {
    verdict: "HOLD",
    confidence: 0.5,
    reason: "",
    sectorTags: [],
    affectedTickers: [],
    originCountryCode: null,
    relevanceScore: 0,
    geoSummary: "",
  };
}
