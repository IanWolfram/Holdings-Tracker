import fs from "fs";
import path from "path";
import { resolveVaultPath, FALLBACK_CONFIDENCE } from "../lib/constants";
import type { VaultStore } from "@/lib/vault/store";

function vaultRoot(vaultPath: string): string {
  return resolveVaultPath(vaultPath) ?? vaultPath;
}

function writeFileAtomic(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, filePath);
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) result[key] = val;
  }
  return result;
}

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

export async function appendVaultLog(storeOrPath: VaultStore | string, entry: LogEntry): Promise<void> {
  try {
    if (typeof storeOrPath === "string") {
      // Legacy path-based call
      const root = vaultRoot(storeOrPath);
      const logPath = path.join(root, "log.md");
      fs.mkdirSync(root, { recursive: true });

      const stamp = nowStamp();
      const block =
        `## [${stamp}] ${entry.type} | ${entry.title}` +
        (entry.details ? `\n${entry.details.trim()}` : "") +
        "\n\n";

      if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, LOG_HEADER + block, "utf-8");
      } else {
        fs.appendFileSync(logPath, block, "utf-8");
      }
    } else {
      // VaultStore-based call
      const store = storeOrPath;
      const stamp = nowStamp();
      const block =
        `## [${stamp}] ${entry.type} | ${entry.title}` +
        (entry.details ? `\n${entry.details.trim()}` : "") +
        "\n\n";

      const existing = await store.read("log.md");
      if (existing === null) {
        await store.write("log.md", LOG_HEADER + block);
      } else {
        await store.append("log.md", block);
      }
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
  storeOrPath: VaultStore | string,
  ticker: string,
  days: number = 7
): Promise<DailyVerdictRow[]> {
  try {
    if (typeof storeOrPath === "string") {
      const dailyDir = path.join(vaultRoot(storeOrPath), "daily");
      if (!fs.existsSync(dailyDir)) return [];

      const files = fs
        .readdirSync(dailyDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .slice(0, days);

      const rows: DailyVerdictRow[] = [];
      const tickerHeader = `[[${ticker}]]`;

      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(dailyDir, file), "utf-8");
          const date = file.replace(/\.md$/, "");

          // Find the section starting with "### [[TICKER]] — N stories ..."
          const lines = content.split("\n");
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
            const match = line.match(/^-\s+\*\*(BUY|SELL|HOLD)\*\*\s+\((\d+)%\)\s+—\s+\[([^\]]+)\]/);
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
        } catch { /* skip unreadable */ }
      }
      return rows;
    } else {
      // VaultStore-based call
      const store = storeOrPath;
      const filenames = (await store.list("daily"))
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .slice(0, days);

      const rows: DailyVerdictRow[] = [];
      const tickerHeader = `[[${ticker}]]`;

      for (const file of filenames) {
        try {
          const content = await store.read(`daily/${file}`);
          if (content === null) continue;
          const date = file.replace(/\.md$/, "");

          const lines = content.split("\n");
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
            const match = line.match(/^-\s+\*\*(BUY|SELL|HOLD)\*\*\s+\((\d+)%\)\s+—\s+\[([^\]]+)\]/);
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
        } catch { /* skip unreadable */ }
      }
      return rows;
    }
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
  storeOrPath: VaultStore | string,
  ticker: string,
  limit: number = 5
): Promise<OpenAlertRef[]> {
  try {
    if (typeof storeOrPath === "string") {
      const alertsDir = path.join(vaultRoot(storeOrPath), "_alerts");
      if (!fs.existsSync(alertsDir)) return [];

      const suffix = `-contradiction-${ticker}.md`;
      const files = fs
        .readdirSync(alertsDir)
        .filter((f) => f.endsWith(suffix))
        .sort()
        .reverse()
        .slice(0, limit);

      return files.map((file) => {
        const content = fs.readFileSync(path.join(alertsDir, file), "utf-8");
        const fm = parseFrontmatter(content);
        return {
          date: fm.date ?? file.slice(0, 10),
          filename: file.replace(/\.md$/, ""),
          buys: parseInt(fm.buys ?? "0", 10) || 0,
          sells: parseInt(fm.sells ?? "0", 10) || 0,
        };
      });
    } else {
      const store = storeOrPath;
      const suffix = `-contradiction-${ticker}.md`;
      const files = (await store.list("_alerts"))
        .filter((f) => f.endsWith(suffix))
        .sort()
        .reverse()
        .slice(0, limit);

      const results: OpenAlertRef[] = [];
      for (const file of files) {
        const content = await store.read(`_alerts/${file}`);
        if (content === null) continue;
        const fm = parseFrontmatter(content);
        results.push({
          date: fm.date ?? file.slice(0, 10),
          filename: file.replace(/\.md$/, ""),
          buys: parseInt(fm.buys ?? "0", 10) || 0,
          sells: parseInt(fm.sells ?? "0", 10) || 0,
        });
      }
      return results;
    }
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
  storeOrPath: VaultStore | string,
  ticker: string,
  limit: number = 8
): Promise<TopStoryRef[]> {
  try {
    if (typeof storeOrPath === "string") {
      const newsDir = path.join(vaultRoot(storeOrPath), "news");
      if (!fs.existsSync(newsDir)) return [];

      const files = fs
        .readdirSync(newsDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .slice(0, 200); // bound the scan; ticker may not appear in every recent file

      const matches: TopStoryRef[] = [];
      for (const file of files) {
        if (matches.length >= limit * 3) break;
        try {
          const content = fs.readFileSync(path.join(newsDir, file), "utf-8");
          const fm = parseFrontmatter(content);
          if (fm.ticker?.toUpperCase() !== ticker.toUpperCase()) continue;
          const verdict = fm.verdict;
          if (!verdict || !["BUY", "SELL", "HOLD"].includes(verdict)) continue;
          const headline = content.match(/^# (.+)$/m)?.[1]?.trim() ?? file;
          matches.push({
            date: fm.date ?? file.slice(0, 10),
            filename: file.replace(/\.md$/, ""),
            verdict,
            confidence: parseFloat(fm.confidence ?? String(FALLBACK_CONFIDENCE)) || FALLBACK_CONFIDENCE,
            headline,
          });
        } catch { /* skip */ }
      }

      // Rank: prefer non-HOLD with high confidence, then break ties by recency
      matches.sort((a, b) => {
        const aSig = a.verdict === "HOLD" ? 0.4 : a.confidence;
        const bSig = b.verdict === "HOLD" ? 0.4 : b.confidence;
        if (aSig !== bSig) return bSig - aSig;
        return b.date.localeCompare(a.date);
      });

      return matches.slice(0, limit);
    } else {
      const store = storeOrPath;
      const files = (await store.list("news"))
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse()
        .slice(0, 200);

      const matches: TopStoryRef[] = [];
      for (const file of files) {
        if (matches.length >= limit * 3) break;
        try {
          const content = await store.read(`news/${file}`);
          if (content === null) continue;
          const fm = parseFrontmatter(content);
          if (fm.ticker?.toUpperCase() !== ticker.toUpperCase()) continue;
          const verdict = fm.verdict;
          if (!verdict || !["BUY", "SELL", "HOLD"].includes(verdict)) continue;
          const headline = content.match(/^# (.+)$/m)?.[1]?.trim() ?? file;
          matches.push({
            date: fm.date ?? file.slice(0, 10),
            filename: file.replace(/\.md$/, ""),
            verdict,
            confidence: parseFloat(fm.confidence ?? String(FALLBACK_CONFIDENCE)) || FALLBACK_CONFIDENCE,
            headline,
          });
        } catch { /* skip */ }
      }

      matches.sort((a, b) => {
        const aSig = a.verdict === "HOLD" ? 0.4 : a.confidence;
        const bSig = b.verdict === "HOLD" ? 0.4 : b.confidence;
        if (aSig !== bSig) return bSig - aSig;
        return b.date.localeCompare(a.date);
      });

      return matches.slice(0, limit);
    }
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// index.md — content catalog of the vault
// ---------------------------------------------------------------------------

interface DirSnapshot {
  files: string[];
}

function readDirSafe(dir: string): DirSnapshot {
  try {
    return { files: fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort() };
  } catch {
    return { files: [] };
  }
}

function tickerSummary(vaultPath: string, file: string): string {
  try {
    const root = vaultRoot(vaultPath);
    const fm = parseFrontmatter(fs.readFileSync(path.join(root, file), "utf-8"));
    const sector = fm.sector ?? "—";
    const updated = fm.date ?? "?";
    return `${sector} · updated ${updated}`;
  } catch {
    return "";
  }
}

function dailySummary(vaultPath: string, dailyFile: string): string {
  try {
    const root = vaultRoot(vaultPath);
    const content = fs.readFileSync(path.join(root, "daily", dailyFile), "utf-8");
    const m = content.match(/Covering \*\*(\d+) stories\*\* across \*\*(\d+) sectors?\*\*/);
    return m ? `${m[1]} stories, ${m[2]} sectors` : "";
  } catch {
    return "";
  }
}

export function regenerateVaultIndex(vaultPath: string): void {
  try {
    const root = vaultRoot(vaultPath);
    if (!fs.existsSync(root)) return;

    const today = new Date().toISOString().split("T")[0];

    // Tickers — top-level *.md files (excluding README.md)
    const topFiles = fs.existsSync(root)
      ? fs.readdirSync(root).filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "log.md" && f !== "index.md")
      : [];

    const catalysts = readDirSafe(path.join(root, "catalysts"));
    const daily = readDirSafe(path.join(root, "daily")).files.reverse().slice(0, 14);
    const insights = readDirSafe(path.join(root, "_insights")).files.reverse().slice(0, 10);
    const alerts = readDirSafe(path.join(root, "_alerts")).files.reverse().slice(0, 10);
    const macro = readDirSafe(path.join(root, "_macro")).files.reverse().slice(0, 5);
    const events = readDirSafe(path.join(root, "_events")).files.reverse().slice(0, 5);
    const news = readDirSafe(path.join(root, "news"));

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
      for (const file of topFiles.sort()) {
        const slug = file.replace(/\.md$/, "");
        const summary = tickerSummary(vaultPath, file);
        lines.push(`- [[${slug}]] — ${summary}`);
      }
      lines.push("");
    }

    if (catalysts.files.length > 0) {
      lines.push("## Catalysts (Concept Pages)");
      for (const file of catalysts.files) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[catalysts/${slug}]]`);
      }
      lines.push("");
    }

    if (daily.length > 0) {
      lines.push(`## Recent Daily Summaries (last ${daily.length})`);
      for (const file of daily) {
        const slug = file.replace(/\.md$/, "");
        const summary = dailySummary(vaultPath, file);
        lines.push(`- [[daily/${slug}]]${summary ? ` — ${summary}` : ""}`);
      }
      lines.push("");
    }

    if (insights.length > 0) {
      lines.push(`## Recent Session Insights (last ${insights.length})`);
      for (const file of insights) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[_insights/${slug}]]`);
      }
      lines.push("");
    }

    if (alerts.length > 0) {
      lines.push(`## Recent Alerts (last ${alerts.length})`);
      for (const file of alerts) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[_alerts/${slug}]]`);
      }
      lines.push("");
    }

    if (macro.length > 0 || events.length > 0) {
      lines.push("## Macro & Events");
      for (const file of macro) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[_macro/${slug}]] — macro snapshot`);
      }
      for (const file of events) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[_events/${slug}]] — earnings & calendar`);
      }
      lines.push("");
    }

    // Graph references — these files are stable
    const graphDir = path.join(root, "_graph");
    if (fs.existsSync(graphDir)) {
      lines.push("## Graph");
      const graphFiles = fs.readdirSync(graphDir).filter((f) => f.endsWith(".md"));
      for (const file of graphFiles) {
        const slug = file.replace(/\.md$/, "");
        lines.push(`- [[_graph/${slug}]]`);
      }
      lines.push("");
    }

    lines.push("## Stats");
    lines.push(`- News stories: ${news.files.length}`);
    lines.push(`- Tickers tracked: ${topFiles.length}`);
    lines.push(`- Days of daily summaries: ${readDirSafe(path.join(root, "daily")).files.length}`);
    lines.push(`- Active alerts: ${readDirSafe(path.join(root, "_alerts")).files.length}`);
    lines.push("");

    writeFileAtomic(path.join(root, "index.md"), lines.join("\n"));
  } catch (err) {
    console.error("[vault-meta] Failed to regenerate index:", err);
  }
}