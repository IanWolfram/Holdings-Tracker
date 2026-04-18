import fs from "fs";
import path from "path";
import { withOllamaSemaphore } from "../lib/classifier";
import { isOllamaHealthy } from "../lib/ollama-health";
import type { Verdict } from "@/types/news.types";

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

export async function analyzeStory(
  ticker: string,
  headline: string,
  summary: string,
  holdingTickers: string[] = [],
  holdingSectors: string[] = []
): Promise<UnifiedAnalysis> {
  const enabled = process.env.OLLAMA_ENABLED === "true";
  if (!enabled) return fallbackAnalysis();

  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model   = process.env.OLLAMA_MODEL   ?? "gemma4-aggro";

  if (!(await isOllamaHealthy(baseUrl))) return fallbackAnalysis();

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
    raw = await withOllamaSemaphore(async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: false,
          options: { temperature: 0.1 },
          messages: [
            { role: "system", content: getSystemPrompt() },
            { role: "user",   content: userMessage },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        console.error(`[brain] Ollama error ${res.status}`);
        throw new Error(`Ollama HTTP ${res.status}`);
      }

      const json = await res.json();
      return (json.message?.content ?? "") as string;
    });
  } catch (err) {
    console.error("[brain] Ollama unreachable:", err);
    return fallbackAnalysis();
  }

  try {
    // Handle JSON wrapped in markdown code fences or bare
    const fence = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    const bare  = raw.match(/\{[\s\S]*\}/);
    const jsonStr = fence?.[1] ?? bare?.[0];
    if (!jsonStr) throw new Error("No JSON found in response");

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
