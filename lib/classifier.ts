export type Verdict = "BUY" | "SELL" | "HOLD";

export interface Classification {
  verdict: Verdict;
  confidence: number;
  reason: string;
  classifiedAt: string;
}

const FALLBACK: Classification = {
  verdict: "HOLD",
  confidence: 0,
  reason: "Classification failed",
  classifiedAt: new Date().toISOString(),
};

const SYSTEM_PROMPT = `You are a financial news classifier. Given a news headline and optional summary, classify the sentiment for the mentioned stock ticker as exactly one of: BUY, SELL, or HOLD.

Rules:
- BUY: clearly positive news (earnings beat, new product, partnership, analyst upgrade)
- SELL: clearly negative news (earnings miss, lawsuit, executive departure, downgrade, scandal)
- HOLD: neutral, ambiguous, or insufficient information

Respond with ONLY a JSON object in this exact format:
{"verdict": "BUY", "confidence": 0.87, "reason": "one sentence explanation"}

Do not include any other text.`;

export async function classifyNews(
  ticker: string,
  headline: string,
  summary: string
): Promise<Classification> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "gemma3:12b";

  const prompt = `${SYSTEM_PROMPT}

Ticker: ${ticker}
Headline: ${headline}
Summary: ${summary || "(none)"}`;

  let raw: string;
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: false, prompt }),
    });

    if (!res.ok) {
      console.error(`[classifier] Ollama error ${res.status}`);
      return { ...FALLBACK, classifiedAt: new Date().toISOString() };
    }

    const json = await res.json();
    raw = json.response ?? "";
  } catch (err) {
    console.error("[classifier] Ollama unreachable:", err);
    return { ...FALLBACK, classifiedAt: new Date().toISOString() };
  }

  try {
    // Extract JSON even if model adds surrounding text
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in response");
    const parsed = JSON.parse(match[0]) as {
      verdict?: string;
      confidence?: number;
      reason?: string;
    };

    const verdict = (["BUY", "SELL", "HOLD"].includes(parsed.verdict ?? "")
      ? parsed.verdict
      : "HOLD") as Verdict;

    return {
      verdict,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      reason: parsed.reason ?? "",
      classifiedAt: new Date().toISOString(),
    };
  } catch {
    console.error("[classifier] JSON parse failed, raw:", raw);
    return { ...FALLBACK, classifiedAt: new Date().toISOString() };
  }
}
