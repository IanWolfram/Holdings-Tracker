/**
 * Smoke test for world-brain/vault-meta.ts.
 * Run with: npx tsx scripts/test-vault-meta.ts
 *
 * Also previews what the new HOOD.md hub page will look like (synthesis stub
 * is replaced with the existing Learned Patterns content from the vault).
 */
import fs from "fs";
import path from "path";
import {
  appendVaultLog,
  regenerateVaultIndex,
  buildVerdictTrend,
  findRecentContradictions,
  findTopRecentStories,
} from "../world-brain/vault-meta";

const vaultPath = "./world-vault";
const TICKER = "HOOD";

console.log("=== buildVerdictTrend ===");
const trend = buildVerdictTrend(vaultPath, TICKER, 7);
console.log(`${trend.length} rows for ${TICKER}`);

console.log("\n=== findRecentContradictions ===");
const contradictions = findRecentContradictions(vaultPath, TICKER, 5);
console.log(`${contradictions.length} contradictions for ${TICKER}`);

console.log("\n=== findTopRecentStories ===");
const top = findTopRecentStories(vaultPath, TICKER, 8);
console.log(`${top.length} top stories for ${TICKER}`);

console.log("\n=== appendVaultLog ===");
appendVaultLog(vaultPath, {
  type: "lint",
  title: `Smoke test for ${TICKER} hub page`,
});

console.log("\n=== regenerateVaultIndex ===");
regenerateVaultIndex(vaultPath);

// Preview the new ticker hub format using the existing learned-patterns body
const existingHood = fs.readFileSync(path.join(vaultPath, `${TICKER}.md`), "utf-8");
const learnedMatch = existingHood.match(/# .+? — Learned Patterns\n\n([\s\S]+?)\n\n_Last updated/);
const synthesis = learnedMatch?.[1]?.trim() ?? "(stub synthesis)";

const today = new Date().toISOString().split("T")[0];
const sector = "Financial Services";

const trendBlock =
  trend.length > 0
    ? [
        "## Verdict Trend (last 7 sessions)",
        "",
        "| Date | BUY | SELL | HOLD | Top Signal |",
        "|------|----:|-----:|-----:|------------|",
        ...trend.map((row) => {
          const t = row.topSignal
            ? `**${row.topSignal.verdict}** ${Math.round(row.topSignal.confidence * 100)}% — ${row.topSignal.headline.slice(0, 70)}`
            : "—";
          return `| ${row.date} | ${row.buys} | ${row.sells} | ${row.holds} | ${t} |`;
        }),
        "",
      ].join("\n")
    : "";

const contradictionBlock =
  contradictions.length > 0
    ? [
        "## Open Contradictions",
        "",
        ...contradictions.map(
          (a) =>
            `- [[_alerts/${a.filename}]] — ${a.buys} BUY vs ${a.sells} SELL on ${a.date}`
        ),
        "",
      ].join("\n")
    : "";

const topStoriesBlock =
  top.length > 0
    ? [
        "## Top Recent Stories",
        "",
        ...top.map(
          (s) =>
            `- **${s.verdict}** ${Math.round(s.confidence * 100)}% — [[news/${s.filename}|${s.headline.slice(0, 90)}]] _(${s.date})_`
        ),
        "",
      ].join("\n")
    : "";

const sections: string[] = [];
if (trendBlock) sections.push(trendBlock);
if (contradictionBlock) sections.push(contradictionBlock);
if (topStoriesBlock) sections.push(topStoriesBlock);
sections.push(`## Learned Patterns\n\n${synthesis}\n`);

const content = [
  "---",
  `date: "${today}"`,
  "type: ticker-knowledge",
  `ticker: ${TICKER}`,
  `sector: ${sector}`,
  "generated: true",
  "tags:",
  "  - ticker-hub",
  `  - ${TICKER.toLowerCase()}`,
  "  - world-brain",
  "---",
  "",
  `# ${TICKER} — Knowledge Hub`,
  "",
  `> ${sector} · Last updated ${today}`,
  "",
  sections.join("\n"),
  `_Last updated: ${today}_`,
  "",
].join("\n");

const previewPath = path.join(vaultPath, `${TICKER}.preview.md`);
fs.writeFileSync(previewPath, content, "utf-8");
console.log(`\nPreview written to ${previewPath}`);
