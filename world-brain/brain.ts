import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Agent context — split into system prompt and rules for /api/chat
// ---------------------------------------------------------------------------

let systemPrompt: string | null = null;

function getSystemPrompt(): string {
  if (!systemPrompt) {
    const dir = path.join(process.cwd(), "world-brain");
    systemPrompt = ["AGENT.md", "sector-rules.md"]
      .map((f) => {
        try {
          return fs.readFileSync(path.join(dir, f), "utf-8");
        } catch {
          return "";
        }
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
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
// Main inference function — single Ollama call for both trading signal + geo
// ---------------------------------------------------------------------------

import { withInferenceSemaphore } from "../lib/classifier";
import { isAiHealthy } from "../lib/ai-health";
import type { Verdict } from "@/types/news.types";

// ... (system prompt logic remains same)

export async function analyzeStory(
  ticker: string,
  headline: string,
  summary: string,
  holdingTickers: string[] = [],
  holdingSectors: string[] = []
): Promise<UnifiedAnalysis> {
  const engine = process.env.AI_ENGINE ?? "ollama";
  const ollamaEnabled = process.env.OLLAMA_ENABLED === "true";
  
  // Backwards compatibility: if OLLAMA_ENABLED is true but AI_ENGINE is not set, use ollama
  const activeEngine = (engine === "mlx" || (engine === "ollama" && ollamaEnabled)) ? engine : "none";
  if (activeEngine === "none") return fallbackAnalysis();

  const baseUrl = engine === "mlx" 
    ? (process.env.MLX_BASE_URL ?? "http://localhost:8080/v1")
    : (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434");

  const model = engine === "mlx"
    ? (process.env.MLX_MODEL ?? "mlx-community/DeepSeek-R1-Distill-Qwen-14B-4bit")
    : (process.env.OLLAMA_MODEL ?? "gemma4-aggro");

  if (!(await isAiHealthy(engine, baseUrl))) {
    console.warn(`[brain] ${engine.toUpperCase()} engine at ${baseUrl} is not responding.`);
    return fallbackAnalysis();
  }

  const holdingsBlock = holdingTickers.length > 0
    ? `Holdings context:\nTickers: ${holdingTickers.join(", ")}\nSectors: ${[...new Set(holdingSectors)].join(", ")}`
    : `Focal ticker: ${ticker}`;

  const userMessage =
    `${holdingsBlock}\n\n` +
    `Focal ticker: ${ticker}\n` +
    `Headline: ${headline}\n` +
    `Summary: ${summary || "(no summary)"}\n\n` +
    `OUTPUT ONLY THE JSON OBJECT. NO MARKDOWN. NO EXPLANATION. START WITH { AND END WITH }.`;

  let raw = "";
  try {
    raw = await withInferenceSemaphore(async () => {
      const isMlx = engine === "mlx";
      const url = isMlx ? `${baseUrl}/chat/completions` : `${baseUrl}/api/chat`;
      
      const body = isMlx 
        ? {
            model,
            messages: [
              { role: "system", content: getSystemPrompt() },
              { role: "user",   content: userMessage },
            ],
            temperature: 0.1,
            stream: false,
          }
        : {
            model,
            stream: false,
            options: { temperature: 0.1 },
            messages: [
              { role: "system", content: getSystemPrompt() },
              { role: "user",   content: userMessage },
            ],
          };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      });

      if (!res.ok) {
        console.error(`[brain] ${engine} error ${res.status}`);
        throw new Error(`${engine} HTTP ${res.status}`);
      }

      const json = await res.json();
      return isMlx ? (json.choices[0]?.message?.content ?? "") : (json.message?.content ?? "");
    });
  } catch (err) {
    console.error(`[brain] ${engine} unreachable:`, err);
    return fallbackAnalysis();
  }

  try {
    // 1. Strip <think> tags (Chain of Thought) if present
    let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

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
