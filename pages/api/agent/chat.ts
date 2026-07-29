import type { NextApiResponse } from "next";
import { callLlm, getSystemPrompt, loadSessionInsights } from "@/world-brain/brain";
import { getVaultStore, type VaultStore } from "@/lib/vault/store";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";
import { apiHandler } from "@/lib/api-handler";
import { rateLimit, CHAT_LIMIT } from "@/lib/rate-limit";
import { type Verdict, VERDICT_LABEL } from "@/types/news.types";

/** Caps on request-body size — bound token spend and oversized-row risk. */
const MAX_MESSAGE_CHARS = 8000;
const MAX_HISTORY_ITEMS = 40;
const MAX_HISTORY_CHARS = 24000;

// ---------------------------------------------------------------------------
// Vault context helpers (async, VaultStore-based)
// ---------------------------------------------------------------------------

/**
 * Read a single ticker's learned-patterns note from the vault root.
 * e.g. world-vault/PLTR.md → "Government contract wins trigger BUY at 85-92%..."
 */
async function readTickerNote(ticker: string, store: VaultStore): Promise<string> {
  try {
    const raw = await store.read(`${ticker.toUpperCase()}.md`);
    if (!raw) return "";
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
async function readRecentVaultNews(store: VaultStore, limit = 12): Promise<string> {
  try {
    const files = (await store.list("news"))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, limit);

    const lines: string[] = [];
    for (const file of files) {
      try {
        const content = await store.read(`news/${file}`);
        if (!content) continue;
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
        const sentiment = VERDICT_LABEL[verdict as Verdict] ?? verdict;
        const conf = fm.confidence ? `${Math.round(parseFloat(fm.confidence) * 100)}%` : "?%";
        const ticker = fm.ticker ?? "?";
        const date = fm.date ?? "?";
        lines.push(`- [${date}] ${ticker} → **${sentiment}** (${conf}): ${headline.slice(0, 90)}`);
      } catch {
        continue;
      }
    }

    if (lines.length === 0) return "";
    return `## Recent Vault News Sentiment (last ${lines.length})\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}

/**
 * Read the latest macro snapshot from world-vault/_macro/.
 */
async function readLatestMacroSnapshot(store: VaultStore): Promise<string> {
  try {
    const files = (await store.list("_macro"))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length === 0) return "";
    const content = await store.read(`_macro/${files[0]}`);
    if (!content) return "";
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
async function readLatestDailySummary(store: VaultStore): Promise<string> {
  try {
    const files = (await store.list("daily"))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length === 0) return "";
    const content = await store.read(`daily/${files[0]}`);
    if (!content) return "";
    const body = content.replace(/^---[\s\S]*?---\n/, "").trim();
    return body ? `## Latest Daily Summary\n${body.slice(0, 1200)}` : "";
  } catch {
    return "";
  }
}

/**
 * Read the N most recent session insight files from world-vault/_insights/.
 */
async function readRecentInsights(store: VaultStore, limit = 3): Promise<string> {
  try {
    const files = (await store.list("_insights"))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse()
      .slice(0, limit);
    const snippets: string[] = [];
    for (const f of files) {
      try {
        const raw = await store.read(`_insights/${f}`);
        if (raw) {
          const body = raw.replace(/^---[\s\S]*?---\n/, "").trim();
          if (body) snippets.push(body);
        }
      } catch { /* skip */ }
    }
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

export default apiHandler(["POST"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  // Per-user throttle: this route drives a paid LLM call, so cap frequency
  // (the coarse per-IP guard in apiHandler is not enough on its own).
  const { allowed, retryAfterMs } = rateLimit(`chat:${user.id}`, CHAT_LIMIT);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "You're sending messages too quickly. Please slow down." });
  }

  const { message, history } = req.body as {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required." });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: "Message is too long." });
  }
  if (history) {
    if (!Array.isArray(history) || history.length > MAX_HISTORY_ITEMS) {
      return res.status(400).json({ error: "Conversation history is too long." });
    }
    const historyChars = history.reduce((n, m) => n + (m?.content?.length ?? 0), 0);
    if (historyChars > MAX_HISTORY_CHARS) {
      return res.status(400).json({ error: "Conversation history is too large." });
    }
  }

  // ---- 1. Holdings context ------------------------------------------------
  let holdingTickers: string[] = [];
  let holdingsContext = "";
  try {
    const { portfolioService } = await getServicesForUser(user.id);
    const { positions } = await portfolioService.getPositionsSafe();
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
  const store = await getVaultStore(user.id);
  // Load this user's session insights now; passed into getSystemPrompt below.
  // Insights are threaded per request and never cached globally, so one tenant's
  // insights can never leak into another tenant's system prompt.
  const sessionInsights = await loadSessionInsights(store);

  {
    const mentionedTickers = detectTickers(message, holdingTickers);

    // Per-ticker learned patterns
    const tickerNotes = (
      await Promise.all(mentionedTickers.map((t) => readTickerNote(t, store)))
    ).filter(Boolean);

    // If no specific tickers mentioned, load notes for all holdings
    if (tickerNotes.length === 0 && holdingTickers.length > 0) {
      const holdingNotes = (
        await Promise.all(holdingTickers.map((t) => readTickerNote(t, store)))
      ).filter(Boolean);
      holdingNotes.forEach((n) => tickerNotes.push(n));
    }

    const recentNews = await readRecentVaultNews(store, 15);
    const macroSnap = await readLatestMacroSnapshot(store);
    const dailySummary = await readLatestDailySummary(store);
    const recentInsights = await readRecentInsights(store, 3);

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
  const systemPrompt = getSystemPrompt(sessionInsights) + CHAT_ADDENDUM + holdingsContext + vaultContext;

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
    const reply = await callLlm(systemPrompt, fullMessage);
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
}, "api/agent/chat");