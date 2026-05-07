import type { VaultStore } from "@/lib/vault/store";

// ---------------------------------------------------------------------------
// log.md — chronological append-only activity log
// ---------------------------------------------------------------------------

export type LogEntryType =
  | "ingest"
  | "daily"
  | "insight"
  | "learn"
  | "alert"
  | "lint"
  | "forecast"
  | "macro"
  | "events";

export interface LogEntry {
  type: LogEntryType;
  title: string;
  details?: string;
}

function nowStamp(): string {
  // YYYY-MM-DD HH:MM:SS in UTC; matches the rest of the vault's date conventions
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const HH = String(d.getUTCHours()).padStart(2, "0");
  const MM = String(d.getUTCMinutes()).padStart(2, "0");
  const SS = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
}

const LOG_HEADER =
  "# Vault Activity Log\n\n" +
  "> Append-only chronological record of vault activity. Most recent at bottom.\n" +
  "> Tip: `grep \"^## \\[\" log.md | tail -10` for the last ten entries.\n\n";

export async function appendVaultLog(store: VaultStore, entry: LogEntry): Promise<void> {
  try {
    const stamp = nowStamp();
    const block =
      `## [${stamp}] ${entry.type} | ${entry.title}` +
      (entry.details ? `\n${entry.details.trim()}` : "") +
      "\n\n";

    if (!(await store.exists("log.md"))) {
      await store.write("log.md", LOG_HEADER + block);
    } else {
      await store.append("log.md", block);
    }
  } catch (err) {
    console.error("[vault-meta] Failed to append log entry:", err);
  }
}

// ---------------------------------------------------------------------------
// Helpers for ticker hub pages
// ---------------------------------------------------------------------------

export interface DailyVerdictRow {
  date: string;
  buys: number;
  sells: number;
  holds: number;
  topSignal?: { verdict: string; confidence: number; headline: string };
}

/**
 * Scans daily/*.md and pulls per-day verdict tallies + the highest-confidence
 * signal for the given ticker. Used to build the verdict-trend table on hub pages.
 */
export async function buildVerdictTrend(
  store: VaultStore,
  ticker: string,
  days: number = 7
): Promise<DailyVerdictRow[]> {
  try {
    const notes = await store.listNotes("daily/");
    // Sort by path descending (path contains date) and take most recent `days`
    notes.sort((a, b) => b.path.localeCompare(a.path));
    const recent = notes.slice(0, days);

    const rows: DailyVerdictRow[] = [];
    const tickerHeader = `[[${ticker}]]`;

    for (const note of recent) {
      try {
        // Extract date from path like "daily/2026-05-05.md"
        const date = note.path.replace(/^daily\//, "").replace(/\.md$/, "");

        const lines = note.body.split("\n");
        let inBlock = false;
        let buys = 0;
        let sells = 0;
        let holds = 0;
        let topSignal: DailyVerdictRow["topSignal"] | undefined;

        for (const line of lines) {
          if (line.startsWith("### ")) {
            inBlock = line.includes(tickerHeader);
            continue;
          }
          if (!inBlock) continue;
          // Bullet format: "- **VERDICT** (XX%) — [headline](url)"
          const match = line.match(
            /^-\s+\*\*(BUY|SELL|HOLD)\*\*\s+\((\d+)%\)\s+—\s+\[([^\]]+)\]/
          );
          if (!match) continue;
          const verdict = match[1];
          const confidence = parseInt(match[2], 10) / 100;
          const headline = match[3];
          if (verdict === "BUY") buys++;
          else if (verdict === "SELL") sells++;
          else holds++;
          if (!topSignal || confidence > topSignal.confidence) {
            topSignal = { verdict, confidence, headline };
          }
        }

        if (buys + sells + holds > 0) {
          rows.push({ date, buys, sells, holds, topSignal });
        }
      } catch {
        /* skip unreadable */
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export interface OpenAlertRef {
  date: string;
  filename: string;
  buys: number;
  sells: number;
}

/**
 * Returns recent contradiction alerts for a ticker, newest first.
 */
export async function findRecentContradictions(
  store: VaultStore,
  ticker: string,
  limit: number = 5
): Promise<OpenAlertRef[]> {
  try {
    const notes = await store.listNotes("_alerts/");
    const pattern = `contradiction-${ticker}`;
    const matches = notes
      .filter((n) => n.path.includes(pattern))
      .sort((a, b) => b.path.localeCompare(a.path))
      .slice(0, limit);

    return matches.map((note) => {
      const fm = note.frontmatter;
      return {
        date: String(fm.date ?? note.path.split("/").pop()?.slice(0, 10) ?? ""),
        filename: note.path.replace(/^_alerts\//, "").replace(/\.md$/, ""),
        buys: parseInt(String(fm.buys ?? "0"), 10) || 0,
        sells: parseInt(String(fm.sells ?? "0"), 10) || 0,
      };
    });
  } catch {
    return [];
  }
}

export interface TopStoryRef {
  date: string;
  filename: string;
  verdict: string;
  confidence: number;
  headline: string;
}

/**
 * Returns the top recent news stories for a ticker, ranked by recency * confidence.
 */
export async function findTopRecentStories(
  store: VaultStore,
  ticker: string,
  limit: number = 8
): Promise<TopStoryRef[]> {
  try {
    const notes = await store.listNotes("news/");
    // Sort by path descending (most recent first)
    notes.sort((a, b) => b.path.localeCompare(a.path));

    // Bound the scan; ticker may not appear in every recent file
    const candidates = notes.slice(0, 200);
    const matches: TopStoryRef[] = [];

    for (const note of candidates) {
      if (matches.length >= limit * 3) break;
      try {
        const fm = note.frontmatter;
        if (String(fm.ticker ?? "").toUpperCase() !== ticker.toUpperCase()) continue;
        const verdict = String(fm.verdict ?? "");
        if (!["BUY", "SELL", "HOLD"].includes(verdict)) continue;
        const headline = note.body.match(/^# (.+)$/m)?.[1]?.trim() ?? note.path;
        matches.push({
          date: String(fm.date ?? note.path.split("/").pop()?.slice(0, 10) ?? ""),
          filename: note.path.replace(/^news\//, "").replace(/\.md$/, ""),
          verdict,
          confidence: parseFloat(String(fm.confidence ?? "0.5")) || 0.5,
          headline,
        });
      } catch {
        /* skip */
      }
    }

    // Rank: prefer non-HOLD with high confidence, then break ties by recency
    matches.sort((a, b) => {
      const aSig = a.verdict === "HOLD" ? 0.4 : a.confidence;
      const bSig = b.verdict === "HOLD" ? 0.4 : b.confidence;
      if (aSig !== bSig) return bSig - aSig;
      return b.date.localeCompare(a.date);
    });

    return matches.slice(0, limit);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// index.md — content catalog of the vault
// ---------------------------------------------------------------------------

async function tickerSummary(store: VaultStore, filePath: string): Promise<string> {
  try {
    const note = await store.readNote(filePath);
    if (!note) return "";
    const fm = note.frontmatter;
    const sector = String(fm.sector ?? "—");
    const updated = String(fm.date ?? "?");
    return `${sector} · updated ${updated}`;
  } catch {
    return "";
  }
}

async function dailySummary(store: VaultStore, dailyPath: string): Promise<string> {
  try {
    const note = await store.readNote(dailyPath);
    if (!note) return "";
    const m = note.body.match(/Covering \*\*(\d+) stories\*\* across \*\*(\d+) sectors?\*\*/);
    return m ? `${m[1]} stories, ${m[2]} sectors` : "";
  } catch {
    return "";
  }
}

export async function regenerateVaultIndex(store: VaultStore): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Fetch directory listings in parallel
    const [
      allTopFiles,
      catalysts,
      dailyFiles,
      insights,
      alerts,
      macro,
      events,
      newsFiles,
      graphFiles,
    ] = await Promise.all([
      store.list(""),
      store.list("catalysts/"),
      store.list("daily/"),
      store.list("_insights/"),
      store.list("_alerts/"),
      store.list("_macro/"),
      store.list("_events/"),
      store.list("news/"),
      store.list("_graph/"),
    ]);

    // Filter and sort top-level .md files (excluding special files)
    const topFiles = allTopFiles
      .filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "log.md" && f !== "index.md")
      .sort();

    const catalystsMd = catalysts.filter((f) => f.endsWith(".md")).sort();
    const dailyMd = dailyFiles.filter((f) => f.endsWith(".md")).sort().reverse().slice(0, 14);
    const insightsMd = insights.filter((f) => f.endsWith(".md")).sort().reverse().slice(0, 10);
    const alertsMd = alerts.filter((f) => f.endsWith(".md")).sort().reverse().slice(0, 10);
    const macroMd = macro.filter((f) => f.endsWith(".md")).sort().reverse().slice(0, 5);
    const eventsMd = events.filter((f) => f.endsWith(".md")).sort().reverse().slice(0, 5);
    const newsMd = newsFiles.filter((f) => f.endsWith(".md"));
    const graphMd = graphFiles.filter((f) => f.endsWith(".md")).sort();

    const lines: string[] = [
      "---",
      "type: vault-index",
      "generated: true",
      `lastUpdated: "${today}"`,
      "tags:",
      "  - index",
      "  - world-brain",
      "---",
      "",
      "# World Vault Index",
      "",
      `> Auto-generated catalog. Last regenerated ${today}. See [[log]] for chronological activity.`,
      "",
    ];

    if (topFiles.length > 0) {
      lines.push("## Tickers (Knowledge Hubs)");
      for (const file of topFiles) {
        const slug = file.replace(/\.md$/, "");
        const summary = await tickerSummary(store, file);
        lines.push(`- [[${slug}]] — ${summary}`);
      }
      lines.push("");
    }

    if (catalystsMd.length > 0) {
      lines.push("## Catalysts (Concept Pages)");
      for (const file of catalystsMd) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[catalysts/${slug}]]`);
      }
      lines.push("");
    }

    if (dailyMd.length > 0) {
      lines.push(`## Recent Daily Summaries (last ${dailyMd.length})`);
      for (const file of dailyMd) {
        const slug = file.replace(/\.md$/, "");
        const summary = await dailySummary(store, `daily/${file}`);
        lines.push(`- [[daily/${slug}]]${summary ? ` — ${summary}` : ""}`);
      }
      lines.push("");
    }

    if (insightsMd.length > 0) {
      lines.push(`## Recent Session Insights (last ${insightsMd.length})`);
      for (const file of insightsMd) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[_insights/${slug}]]`);
      }
      lines.push("");
    }

    if (alertsMd.length > 0) {
      lines.push(`## Recent Alerts (last ${alertsMd.length})`);
      for (const file of alertsMd) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[_alerts/${slug}]]`);
      }
      lines.push("");
    }

    if (macroMd.length > 0 || eventsMd.length > 0) {
      lines.push("## Macro & Events");
      for (const file of macroMd) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[_macro/${slug}]] — macro snapshot`);
      }
      for (const file of eventsMd) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[_events/${slug}]] — earnings & calendar`);
      }
      lines.push("");
    }

    if (graphMd.length > 0) {
      lines.push("## Graph");
      for (const file of graphMd) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[_graph/${slug}]]`);
      }
      lines.push("");
    }

    const totalDailyFiles = dailyFiles.filter((f) => f.endsWith(".md")).length;
    const totalAlertFiles = alerts.filter((f) => f.endsWith(".md")).length;

    lines.push("## Stats");
    lines.push(`- News stories: ${newsMd.length}`);
    lines.push(`- Tickers tracked: ${topFiles.length}`);
    lines.push(`- Days of daily summaries: ${totalDailyFiles}`);
    lines.push(`- Active alerts: ${totalAlertFiles}`);
    lines.push("");

    await store.write("index.md", lines.join("\n"));
  } catch (err) {
    console.error("[vault-meta] Failed to regenerate index:", err);
  }
}