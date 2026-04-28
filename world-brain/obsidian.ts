import fs from "fs";
import path from "path";
import { getVaultIndex, updateVaultIndex } from "../lib/vault-index";
import { resolveVaultPath } from "../lib/constants";
import type { GeoStory, WorldData } from "@/types/geo.types";
import type { EventsSnapshot } from "../lib/marketdata/events";
import type { MacroSnapshot } from "../lib/marketdata/macro";

function computeDecayScore(storyDateMs: number, nowMs: number = Date.now()): number {
  // exp(-age_days / 7): a 1-week-old note is at ~0.37, a month is ~0.013.
  const ageDays = Math.max(0, (nowMs - storyDateMs) / 86_400_000);
  return Math.max(0, Math.min(1, Math.exp(-ageDays / 7)));
}

function buildNoteContent(story: GeoStory, dateStr: string, sector?: string): string {
  const decayScore = computeDecayScore(story.datetime * 1000);
  return [
    "---",
    `date: "${dateStr}"`,
    `ticker: ${story.ticker}`,
    ...(sector ? [`sector: ${sector}`] : []),
    `verdict: ${story.verdict}`,
    `confidence: ${story.confidence.toFixed(2)}`,
    `relevance: ${story.relevanceScore.toFixed(2)}`,
    `decayScore: ${decayScore.toFixed(4)}`,
    `verified: ${story.isAnalyzed ?? false}`,
    `country: ${story.originCountryCode ?? "unknown"}`,
    `source: ${story.source}`,
    `url: "${story.url}"`,
    ...(story.catalystTypes && story.catalystTypes.length > 0
      ? ["catalystTypes:", ...story.catalystTypes.map((type) => `  - ${type}`)]
      : []),
    "tags:",
    ...[
      "news",
      story.ticker.toLowerCase(),
      story.verdict.toLowerCase(),
      "world-brain",
      ...(sector ? [sector.toLowerCase().replace(/\s+/g, "-")] : []),
      ...(story.catalystTypes?.map((type) => `catalyst-${type}`) ?? []),
      ...(story.isAnalyzed ? ["m5-verified"] : []),
    ].map((t) => `  - ${t}`),
    "---",
    "",
    `# ${story.headline}`,
    "",
    `**Verdict**: ${story.verdict} (${Math.round(story.confidence * 100)}% confidence)  `,
    `**Relevance to [[${story.ticker}]]**: ${Math.round(story.relevanceScore * 100)}%  `,
    `**Geographic origin**: ${story.originCountryCode ?? "Unknown"}  `,
    "",
    "## Summary",
    story.summary || "_No summary available._",
    "",
    "## AI Analysis",
    story.reason ?? "_No analysis available._",
    "",
    "## Links",
    `- [Source Article](${story.url})`,
    `- [[${story.ticker}]]`,
    ...(story.catalystTypes?.map((type) => `- [[catalysts/${type}]]`) ?? []),
    ...(story.originCountryCode ? [`- [[${story.originCountryCode}-news]]`] : []),
    "",
  ].join("\n");
}

function vaultRoot(vaultPath: string): string {
  return resolveVaultPath(vaultPath) ?? vaultPath;
}

// ---------------------------------------------------------------------------
// Individual story note
// ---------------------------------------------------------------------------

export async function writeStoryNote(story: GeoStory, vaultPath: string, sector?: string): Promise<void> {
  try {
    const date = new Date(story.datetime * 1000);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
    const slug = story.headline
      .slice(0, 50)
      .replace(/[^a-z0-9]/gi, "-")
      .replace(/-+/g, "-")
      .toLowerCase();
    const newsDir = path.join(vaultRoot(vaultPath), "news");
    const notePath = path.join(newsDir, `${dateStr}-${slug}.md`);

    // If a file for this URL already exists (possibly under a different slug), use that path
    // and skip if it's already verified — don't downgrade an MLX-verified entry.
    // Optimized duplicate check using the Vault Index
    const index = await getVaultIndex(vaultPath);
    const existing = index.get(story.url);
    if (existing) {
      if (existing.isAnalyzed && !story.isAnalyzed) return;
      // Skip if content is identical (simplified check)
      if (existing.verdict === story.verdict && existing.isAnalyzed === !!story.isAnalyzed) {
        return;
      }
      fs.writeFileSync(existing.filePath, buildNoteContent(story, dateStr, sector), "utf-8");
      updateVaultIndex(story.url, {
        verdict: story.verdict,
        confidence: story.confidence,
        reason: story.reason,
        relevanceScore: story.relevanceScore,
        originCountryCode: story.originCountryCode || null,
        catalystTypes: story.catalystTypes,
        classifiedAt: dateStr,
        isAnalyzed: !!story.isAnalyzed,
        fromVault: true,
        filePath: existing.filePath,
      });
      return;
    }

    fs.mkdirSync(path.dirname(notePath), { recursive: true });
    fs.writeFileSync(notePath, buildNoteContent(story, dateStr, sector), "utf-8");
    
    // Update index so subsequent writes in this process know about the new file
    updateVaultIndex(story.url, {
      verdict: story.verdict,
      confidence: story.confidence,
      reason: story.reason,
      relevanceScore: story.relevanceScore,
      originCountryCode: story.originCountryCode || null,
      catalystTypes: story.catalystTypes,
      classifiedAt: dateStr,
      isAnalyzed: !!story.isAnalyzed,
      fromVault: true,
      filePath: notePath,
    });
  } catch (err) {
    console.error("[obsidian] Failed to write story note:", err);
  }
}

// ---------------------------------------------------------------------------
// Daily summary note
// ---------------------------------------------------------------------------

export function writeDailySummary(
  date: string,
  stories: GeoStory[],
  vaultPath: string,
  baseData: WorldData
): void {
  try {
    const notePath = path.join(vaultRoot(vaultPath), "daily", `${date}.md`);
    fs.mkdirSync(path.dirname(notePath), { recursive: true });

    // Group by sector, then by ticker
    const bySector: Record<string, Record<string, GeoStory[]>> = {};
    for (const story of stories) {
      const profile = (baseData as WorldData)?.profiles?.[story.ticker];
      const sector = profile?.sector ?? "Mixed / Uncategorized";
      bySector[sector] ??= {};
      bySector[sector][story.ticker] ??= [];
      bySector[sector][story.ticker].push(story);
    }

    const sectors = Object.keys(bySector).sort();

    const content = [
      "---",
      `date: "${date}"`,
      "type: daily-summary",
      "tags:",
      "  - daily",
      "  - summary",
      "  - world-brain",
      "---",
      "",
      `# Daily World Summary — ${date}`,
      "",
      `> Covering **${stories.length} stories** across **${Object.keys(bySector).length} sectors**`,
      "",
      ...sectors.flatMap((sector) => {
        const tickersInSector = bySector[sector];
        const tickerNames = Object.keys(tickersInSector).sort();
        
        return [
          `## 📁 ${sector.toUpperCase()}`,
          "",
          ...tickerNames.flatMap((ticker) => {
            const ss = tickersInSector[ticker];
            const buys = ss.filter((s) => s.verdict === "BUY").length;
            const sells = ss.filter((s) => s.verdict === "SELL").length;
            return [
              `### [[${ticker}]] — ${ss.length} stories (${buys} BUY / ${sells} SELL)`,
              "",
              ...ss.map(
                (s) =>
                  `- **${s.verdict}** (${Math.round(s.confidence * 100)}%) — [${s.headline}](${s.url})`
              ),
              "",
            ];
          })
        ];
      }),
    ].join("\n");

    fs.writeFileSync(notePath, content, "utf-8");
  } catch (err) {
    console.error("[obsidian] Failed to write daily summary:", err);
  }
}

function macroValue(value: number | null): string {
  return value === null ? "null" : value.toFixed(2);
}

export function writeMacroSnapshot(
  date: string,
  snapshot: MacroSnapshot,
  vaultPath: string,
  commentary?: string
): void {
  try {
    const notePath = path.join(vaultRoot(vaultPath), "_macro", `${date}.md`);
    fs.mkdirSync(path.dirname(notePath), { recursive: true });

    const content = [
      "---",
      `date: \"${date}\"`,
      "type: macro-snapshot",
      `regime: ${snapshot.regime}`,
      `vix: ${macroValue(snapshot.vix)}`,
      `tenY: ${macroValue(snapshot.tenY)}`,
      `dxy: ${macroValue(snapshot.dxy)}`,
      `dxyTrend: ${snapshot.dxyTrend}`,
      `fedFunds: ${macroValue(snapshot.fedFunds)}`,
      `cpi: ${macroValue(snapshot.cpi)}`,
      "tags:",
      "  - macro",
      "  - world-brain",
      "---",
      "",
      `# Macro Snapshot - ${date}`,
      "",
      `Regime: ${snapshot.regime}`,
      `VIX: ${snapshot.vix === null ? "n/a" : snapshot.vix.toFixed(2)}`,
      `10Y: ${snapshot.tenY === null ? "n/a" : `${snapshot.tenY.toFixed(2)}%`}`,
      `DXY: ${snapshot.dxy === null ? "n/a" : snapshot.dxy.toFixed(2)} (${snapshot.dxyTrend})`,
      `Fed Funds: ${snapshot.fedFunds === null ? "n/a" : `${snapshot.fedFunds.toFixed(2)}%`}`,
      `CPI: ${snapshot.cpi === null ? "n/a" : snapshot.cpi.toFixed(2)}`,
      "",
      "## META-ANALYST Commentary",
      commentary?.trim() || snapshot.summary,
      "",
    ].join("\n");

    fs.writeFileSync(notePath, content, "utf-8");
  } catch (err) {
    console.error("[obsidian] Failed to write macro snapshot:", err);
  }
}

export function writeEventsSnapshot(
  date: string,
  snapshot: EventsSnapshot,
  vaultPath: string
): void {
  try {
    const notePath = path.join(vaultRoot(vaultPath), "_events", `${date}.md`);
    fs.mkdirSync(path.dirname(notePath), { recursive: true });

    const earningsLines =
      snapshot.earnings.length > 0
        ? snapshot.earnings.map((event) => {
            const epsEstimate =
              event.epsEstimate === null ? "n/a" : event.epsEstimate.toFixed(2);
            return `- [[${event.ticker}]] earnings (${event.hour ?? "unspecified"}, EPS est ${epsEstimate})`;
          })
        : ["- No earnings events for tracked holdings."];

    const macroLines =
      snapshot.macroEvents.length > 0
        ? snapshot.macroEvents.map((event) => `- ${event.title} (${event.type.toUpperCase()})`)
        : ["- No scheduled Fed/CPI/jobs events today."];

    const content = [
      "---",
      `date: \"${date}\"`,
      "type: events-snapshot",
      `earningsCount: ${snapshot.earnings.length}`,
      `macroEventCount: ${snapshot.macroEvents.length}`,
      "tags:",
      "  - events",
      "  - world-brain",
      "---",
      "",
      `# Events Snapshot - ${date}`,
      "",
      "## Earnings",
      ...earningsLines,
      "",
      "## Fed and Macro Calendar",
      ...macroLines,
      "",
    ].join("\n");

    fs.writeFileSync(notePath, content, "utf-8");
  } catch (err) {
    console.error("[obsidian] Failed to write events snapshot:", err);
  }
}
