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
// The model often omits the opening <think> tag, outputting raw thinking
// text followed by </think>. Handle both cases.
// ---------------------------------------------------------------------------

function stripThink(raw: string): string {
  // Case 1: proper <think>...</think> wrapper
  let stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Case 2: thinking content starts at position 0, only closing </think> present
  const closeIdx = stripped.lastIndexOf("</think>");
  if (closeIdx !== -1) {
    stripped = stripped.slice(closeIdx + "</think>".length).trim();
  }
  return stripped;
}

// ---------------------------------------------------------------------------
// Main inference function — single Ollama call for both trading signal + geo
// ---------------------------------------------------------------------------

import { withInferenceSemaphore } from "../lib/classifier";
import { isAiHealthy } from "../lib/ai-health";
import type { Verdict } from "@/types/news.types";

// ... (system prompt logic remains same)

export async function callMlxRaw(systemPromptText: string, userMessage: string): Promise<string> {
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
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder("utf-8");
      let localRaw = "";
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
            if (content) localRaw += content;
          } catch { /* ignore partial chunks */ }
        }
      }
      return localRaw;
    });
    return stripThink(raw);
  } catch (err) {
    console.error("[brain] callMlxRaw error:", err);
    return "";
  }
}

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
  const baseUrl = process.env.MLX_BASE_URL ?? "http://localhost:8080/v1";
  const model = process.env.MLX_MODEL ?? "mlx-community/DeepSeek-R1-Distill-Qwen-14B-4bit";

  if (!(await isAiHealthy("mlx", baseUrl))) {
    console.warn(`[brain] MLX engine at ${baseUrl} is not responding.`);
    return fallbackAnalysis();
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
    raw = await withInferenceSemaphore(async () => {
      const url = `${baseUrl}/chat/completions`;
      const body = {
        model,
        messages: [
          { role: "system", content: getSystemPrompt() },
          { role: "user",   content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        stream: true,
      };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      });

      if (!res.ok) {
        console.error(`[brain] MLX error ${res.status}`);
        throw new Error(`MLX HTTP ${res.status}`);
      }
      
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder("utf-8");
      
      let localRaw = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;
            if (!dataStr) continue;
            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                localRaw += content;
                onStream?.(localRaw);
              }
            } catch (e) {
              // Ignore partial JSON parsing errors
            }
          }
        }
      }
      
      return localRaw;
    });
  } catch (err) {
    console.error(`[brain] MLX unreachable:`, err);
    return fallbackAnalysis();
  }

  try {
    // 1. Strip <think> tags (Chain of Thought) if present
    let cleaned = stripThink(raw);

    // 2. Clear out any "Alright, let's break this down" or introductory conversational filler
    // We look for the first '{' and the last '}' to isolate the JSON object
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    let jsonStr = "";
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
    } else {
      // Fallback to regex if substringing fails
      const fence = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      jsonStr = fence?.[1] ?? "";
    }

    if (!jsonStr) {
      console.warn(`[brain] No JSON found in response for ${headline}. Full raw response follows:`);
      console.warn(`────────────────────────────────────────────────────────────`);
      console.warn(raw);
      console.warn(`────────────────────────────────────────────────────────────`);
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
