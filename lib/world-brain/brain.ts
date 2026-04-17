import fs from "fs";
import path from "path";
import { withOllamaSemaphore } from "../classifier";

// ---------------------------------------------------------------------------
// Agent context — loaded once from lib/world-brain/*.md
// ---------------------------------------------------------------------------

let agentContext: string | null = null;

function getAgentContext(): string {
  if (!agentContext) {
    const dir = path.join(process.cwd(), "lib", "world-brain");
    agentContext = ["AGENT.md", "sector-rules.md"]
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
  return agentContext;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BrainAnalysis {
  sectorTags: string[];
  affectedTickers: string[];
  originCountryCode: string | null;
  relevanceScore: number;
  geoSummary: string;
}

// ---------------------------------------------------------------------------
// Main inference function
// ---------------------------------------------------------------------------

export async function analyzeStory(
  headline: string,
  summary: string,
  holdingTickers: string[],
  holdingSectors: string[]
): Promise<BrainAnalysis> {
  const enabled = process.env.OLLAMA_ENABLED === "true";
  if (!enabled) {
    return fallbackAnalysis();
  }

  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "gemma4-aggro";
  const context = getAgentContext();

  const prompt = `${context}

---

Holdings context:
Tickers: ${holdingTickers.join(", ")}
Sectors: ${[...new Set(holdingSectors)].join(", ")}

Analyze this news article:
Headline: ${headline}
Summary: ${summary || "(no summary)"}`;

  let raw = "";
  try {
    raw = await withOllamaSemaphore(async () => {
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, stream: false, prompt }),
        signal: AbortSignal.timeout(180_000),
      });

      if (!res.ok) {
        console.error(`[world-brain] Ollama error ${res.status}`);
        throw new Error(`Ollama HTTP ${res.status}`);
      }

      const json = await res.json();
      return (json.response ?? "") as string;
    });
  } catch (err) {
    console.error("[world-brain] Ollama unreachable:", err);
    return fallbackAnalysis();
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in world-brain response");
    const parsed = JSON.parse(match[0]) as {
      sector_tags?: string[];
      affected_tickers?: string[];
      origin_country_code?: string | null;
      relevance_score?: number;
      geo_summary?: string;
    };

    return {
      sectorTags: Array.isArray(parsed.sector_tags) ? parsed.sector_tags : [],
      // Only return tickers that are actual holdings
      affectedTickers: (Array.isArray(parsed.affected_tickers) ? parsed.affected_tickers : [])
        .filter((t) => holdingTickers.includes(t)),
      originCountryCode: typeof parsed.origin_country_code === "string"
        ? parsed.origin_country_code
        : null,
      relevanceScore: typeof parsed.relevance_score === "number"
        ? Math.max(0, Math.min(1, parsed.relevance_score))
        : 0.5,
      geoSummary: parsed.geo_summary ?? headline,
    };
  } catch {
    console.error("[world-brain] JSON parse failed, raw:", raw.slice(0, 200));
    return fallbackAnalysis();
  }
}

function fallbackAnalysis(): BrainAnalysis {
  return {
    sectorTags: [],
    affectedTickers: [],
    originCountryCode: null,
    relevanceScore: 0.5,
    geoSummary: "",
  };
}
