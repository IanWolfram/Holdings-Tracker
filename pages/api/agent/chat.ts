import fs from "fs";
import path from "path";
import { NextApiRequest, NextApiResponse } from "next";
import { callMlxRaw, getSystemPrompt } from "@/world-brain/brain";
import { getPositions } from "@/lib/etrade";
import { WORLD_VAULT_PATH, resolveVaultPath } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Vault context helpers
// ---------------------------------------------------------------------------

/**
 * Read a single ticker's learned-patterns note from the vault root.
 * e.g. world-vault/PLTR.md → "Government contract wins trigger BUY at 85-92%..."
 */
function readTickerNote(ticker: string, vaultResolved: string): string {
  try {
    const p = path.join(vaultResolved, `${ticker.toUpperCase()}.md`);
    const raw = fs.readFileSync(p, "utf-8");
    // Strip frontmatter and return the body only
    const body = raw.replace(/^---[\s\S]*?---\n/, "").trim();
    return body ? `### ${ticker} — Learned Patterns\n${body}` : "";
  } catch {
    return "";
  }
}

/**
 * Detect tickers mentioned in the user message by matching against known
 * holdings tickers and/or any ALL-CAPS 2-5 letter word.
 */
function detectTickers(text: string, holdingTickers: string[]): string[] {
  const mentioned = new Set<string>();
  // Match from holdings list first (case-insensitive)
  for (const t of holdingTickers) {
    if (new RegExp(`\\b${t}\\b`, "i").test(text)) mentioned.add(t.toUpperCase());
  }
  // Also catch any ALL-CAPS 1-5 letter words that look like tickers
  const caps = text.match(/\b[A-Z]{1,5}\b/g) ?? [];
  for (const c of caps) mentioned.add(c);
  return [...mentioned];
}

/**
 * Read the N most-recent news verdict notes from world-vault/news/ and
 * return a condensed summary for chat context.
 */
function readRecentVaultNews(vaultResolved: string, limit = 12): string {
  try {
    const newsDir = path.join(vaultResolved, "news");
    if (!fs.existsSync(newsDir)) return "";

    const files = fs
      .readdirSync(newsDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, limit);

    const lines: string[] = [];
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(newsDir, file), "utf-8");
        // Parse frontmatter
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        const fm: Record<string, string> = {};
        for (const line of fmMatch[1].split("\n")) {
          const idx = line.indexOf(":");
          if (idx === -1) continue;
          fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        }
        // Extract headline from body
        const headlineMatch = content.match(/^# (.+)$/m);
        const headline = headlineMatch?.[1] ?? file;
        const verdict = fm.verdict ?? "HOLD";
        const conf = fm.confidence ? `${Math.round(parseFloat(fm.confidence) * 100)}%` : "?%";
        const ticker = fm.ticker ?? "?";
        const date = fm.date ?? "?";
        lines.push(`- [${date}] ${ticker} → **${verdict}** (${conf}): ${headline.slice(0, 90)}`);
      } catch {
        continue;
      }
    }

    if (lines.length === 0) return "";
    return `## Recent Vault News Verdicts (last ${lines.length})\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

/**
 * Read the latest macro snapshot from world-vault/_macro/.
 */
function readLatestMacroSnapshot(vaultResolved: string): string {
  try {
    const macroDir = path.join(vaultResolved, "_macro");
    if (!fs.existsSync(macroDir)) return "";
    const files = fs
      .readdirSync(macroDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length === 0) return "";
    const content = fs.readFileSync(path.join(macroDir, files[0]), "utf-8");
    // Strip frontmatter
    const body = content.replace(/^---[\s\S]*?---\n/, "").trim();
    return body ? `## Latest Macro Snapshot\n${body.slice(0, 800)}` : "";
  } catch {
    return "";
  }
}

/**
 * Read the most recent daily summary from world-vault/daily/.
 */
function readLatestDailySummary(vaultResolved: string): string {
  try {
    const dailyDir = path.join(vaultResolved, "daily");
    if (!fs.existsSync(dailyDir)) return "";
    const files = fs
      .readdirSync(dailyDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length === 0) return "";
    const content = fs.readFileSync(path.join(dailyDir, files[0]), "utf-8");
    const body = content.replace(/^---[\s\S]*?---\n/, "").trim();
    return body ? `## Latest Daily Summary\n${body.slice(0, 1200)}` : "";
  } catch {
    return "";
  }
}

/**
 * Read the N most recent session insight files from world-vault/_insights/.
 */
function readRecentInsights(vaultResolved: string, limit = 3): string {
  try {
    const insightsDir = path.join(vaultResolved, "_insights");
    if (!fs.existsSync(insightsDir)) return "";
    const files = fs
      .readdirSync(insightsDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, limit);
    const snippets = files
      .map((f) => {
        try {
          const raw = fs.readFileSync(path.join(insightsDir, f), "utf-8");
          return raw.replace(/^---[\s\S]*?---\n/, "").trim();
        } catch { return ""; }
      })
      .filter(Boolean);
    if (snippets.length === 0) return "";
    return `## Recent Session Insights (last ${snippets.length} sessions)\n\n${snippets.join("\n\n---\n\n")}`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Chat system prompt — reuses the full brain prompt + chat addendum
// ---------------------------------------------------------------------------

const CHAT_ADDENDUM = `

---

## Chat Mode

You are now in interactive chat mode with the portfolio owner. Unlike story analysis mode (which outputs JSON), respond in plain, conversational prose. Be direct, insightful, and concise. Reference vault data, learned patterns, and recent verdicts when relevant. Do NOT output JSON unless explicitly asked.`;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { message, history } = req.body as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required." });
  }

  // ---- 1. Holdings context ------------------------------------------------
  let holdingTickers: string[] = [];
  let holdingsContext = "";
  try {
    const positions = await getPositions();
    if (positions.length > 0) {
      holdingTickers = positions.map((p) => p.ticker);
      holdingsContext =
        `\n\n## User's Current Holdings\n` +
        positions
          .map(
            (p) =>
              `- **${p.ticker}**: market value $${p.marketValue?.toFixed(0) ?? "?"}, ` +
              `P/L $${p.gainLoss?.toFixed(0) ?? "?"}`
          )
          .join("\n");
    }
  } catch {
    /* fall through — vault context still injected */
  }

  // ---- 2. Vault context ---------------------------------------------------
  let vaultContext = "";
  const vaultResolved = WORLD_VAULT_PATH ? resolveVaultPath(WORLD_VAULT_PATH) : null;

  if (vaultResolved && fs.existsSync(vaultResolved)) {
    const mentionedTickers = detectTickers(message, holdingTickers);

    // Per-ticker learned patterns
    const tickerNotes = mentionedTickers
      .map((t) => readTickerNote(t, vaultResolved))
      .filter(Boolean);

    // If no specific tickers mentioned, load notes for all holdings
    if (tickerNotes.length === 0 && holdingTickers.length > 0) {
      holdingTickers
        .map((t) => readTickerNote(t, vaultResolved))
        .filter(Boolean)
        .forEach((n) => tickerNotes.push(n));
    }

    const recentNews = readRecentVaultNews(vaultResolved, 15);
    const macroSnap = readLatestMacroSnapshot(vaultResolved);
    const dailySummary = readLatestDailySummary(vaultResolved);
    const recentInsights = readRecentInsights(vaultResolved, 3);

    const parts = [
      tickerNotes.length > 0
        ? `## Ticker Knowledge (from Obsidian Vault)\n\n${tickerNotes.join("\n\n")}`
        : "",
      recentInsights,
      recentNews,
      macroSnap,
      dailySummary,
    ].filter(Boolean);

    if (parts.length > 0) {
      vaultContext = `\n\n---\n\n## Obsidian Vault Context\n\n${parts.join("\n\n---\n\n")}`;
    }
  }

  // ---- 3. Build system prompt ---------------------------------------------
  const systemPrompt = getSystemPrompt() + CHAT_ADDENDUM + holdingsContext + vaultContext;

  // ---- 4. Build user message with history ---------------------------------
  let fullMessage = message;
  if (history && history.length > 0) {
    const historyText = history
      .map((m) => `${m.role === "user" ? "User" : "Pulse"}: ${m.content}`)
      .join("\n");
    fullMessage = `Previous conversation:\n${historyText}\n\nUser: ${message}`;
  }

  // ---- 5. Inference -------------------------------------------------------
  try {
    const reply = await callMlxRaw(systemPrompt, fullMessage);
    if (!reply) {
      return res.status(503).json({
        error: "AI engine unavailable. Check that your model is configured and running.",
      });
    }
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("[api/agent/chat] Error:", err);
    return res.status(500).json({ error: "Inference failed." });
  }
}
