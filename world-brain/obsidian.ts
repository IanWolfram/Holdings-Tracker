import fs from "fs";
import path from "path";
import type { GeoStory, WorldData } from "@/types/geo.types";

function buildNoteContent(story: GeoStory, dateStr: string, sector?: string): string {
  return [
    "---",
    `date: "${dateStr}"`,
    `ticker: ${story.ticker}`,
    ...(sector ? [`sector: ${sector}`] : []),
    `verdict: ${story.verdict}`,
    `confidence: ${story.confidence.toFixed(2)}`,
    `relevance: ${story.relevanceScore.toFixed(2)}`,
    `verified: ${story.isAnalyzed ?? false}`,
    `country: ${story.originCountryCode ?? "unknown"}`,
    `source: ${story.source}`,
    `url: "${story.url}"`,
    "tags:",
    ...[
      "news",
      story.ticker.toLowerCase(),
      story.verdict.toLowerCase(),
      "world-brain",
      ...(sector ? [sector.toLowerCase().replace(/\s+/g, "-")] : []),
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
    ...(story.originCountryCode ? [`- [[${story.originCountryCode}-news]]`] : []),
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Individual story note
// ---------------------------------------------------------------------------

export function writeStoryNote(story: GeoStory, vaultPath: string, sector?: string): void {
  try {
    const date = new Date(story.datetime * 1000);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
    const slug = story.headline
      .slice(0, 50)
      .replace(/[^a-z0-9]/gi, "-")
      .replace(/-+/g, "-")
      .toLowerCase();
    const newsDir = path.join(vaultPath, "news");
    const notePath = path.join(newsDir, `${dateStr}-${slug}.md`);

    // If a file for this URL already exists (possibly under a different slug), use that path
    // and skip if it's already verified — don't downgrade an MLX-verified entry.
    try {
      const existing = fs.readdirSync(newsDir).find((f) => {
        if (!f.endsWith(".md")) return false;
        const content = fs.readFileSync(path.join(newsDir, f), "utf-8");
        return content.includes(`url: "${story.url}"`);
      });
      if (existing) {
        const existingContent = fs.readFileSync(path.join(newsDir, existing), "utf-8");
        if (existingContent.includes("verified: true") && !story.isAnalyzed) return;
        // Use the existing path so we don't create a duplicate
        const resolvedPath = path.join(newsDir, existing);
        if (resolvedPath !== notePath) {
          // Write to existing path, skip the default slug path
          fs.writeFileSync(resolvedPath, buildNoteContent(story, dateStr, sector), "utf-8");
          return;
        }
      }
    } catch { /* directory may not exist yet — fall through to normal write */ }

    fs.mkdirSync(path.dirname(notePath), { recursive: true });
    fs.writeFileSync(notePath, buildNoteContent(story, dateStr, sector), "utf-8");
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
    const notePath = path.join(vaultPath, "daily", `${date}.md`);
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
