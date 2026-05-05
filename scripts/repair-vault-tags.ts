/**
 * Repair vault data: fix analysisFailed stories, recompute heuristic relevance.
 *
 * Scans all news/*.md files in the vault. For each:
 * - If "Analysis unavailable" in AI Analysis section → set analysisFailed: true, verified: false, add analysis-failed tag, remove m5-verified tag
 * - If relevance: 0.00 and ticker is in the headline or summary → recompute heuristic relevance
 */
import fs from "fs";
import path from "path";

const VAULT_PATH = process.env.WORLD_VAULT_PATH ?? "world-vault";

function resolveVaultPath(vaultPath: string): string {
  if (fs.existsSync(vaultPath) && fs.statSync(vaultPath).isDirectory()) return vaultPath;
  const cwdPath = path.join(process.cwd(), vaultPath);
  if (fs.existsSync(cwdPath) && fs.statSync(cwdPath).isDirectory()) return cwdPath;
  throw new Error(`Vault path not found: ${vaultPath}`);
}

function computeHeuristicRelevance(ticker: string, headline: string, summary: string): number {
  const upper = ticker.toUpperCase();
  const headlineUpper = headline.toUpperCase();
  const summaryUpper = (summary ?? "").toUpperCase();
  if (headlineUpper.includes(upper)) return 0.85;
  if (summaryUpper.includes(upper)) return 0.65;
  return 0.3;
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

function repairVault() {
  const resolved = resolveVaultPath(VAULT_PATH);
  const newsDir = path.join(resolved, "news");

  if (!fs.existsSync(newsDir)) {
    console.error(`News directory not found: ${newsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(newsDir).filter((f) => f.endsWith(".md"));
  console.log(`Scanning ${files.length} vault notes...`);

  let repaired = 0;
  let relevanceFixed = 0;

  for (const file of files) {
    const filePath = path.join(newsDir, file);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const fm = parseFrontmatter(content);
    let modified = false;

    // Check for failed analysis
    const analysisSection = content.match(/## AI Analysis\n([\s\S]*?)(?:\n##|$)/);
    const hasFailedAnalysis =
      fm.analysisFailed === "true" ||
      (analysisSection && analysisSection[1].includes("Analysis unavailable")) ||
      (analysisSection && analysisSection[1].includes("analysis failed"));

    if (hasFailedAnalysis && fm.analysisFailed !== "true") {
      // Set analysisFailed: true in frontmatter
      content = content.replace(/^verified: true$/m, "verified: false");
      if (!content.includes("analysisFailed:")) {
        content = content.replace(/^---\n/, `---\nanalysisFailed: true\n`);
      } else {
        content = content.replace(/^analysisFailed: .*$/m, "analysisFailed: true");
      }

      // Add analysis-failed tag, remove m5-verified tag
      content = content.replace(/^  - m5-verified$/m, "  - analysis-failed");

      // Replace AI Analysis section
      content = content.replace(
        /## AI Analysis\n[\s\S]*?(?=\n##|$)/,
        "## AI Analysis\n> **Analysis failed.** Default HOLD at 50%. Do not use for pattern learning."
      );

      modified = true;
      repaired++;
    }

    // Recompute heuristic relevance for stories with 0.00 relevance
    const ticker = fm.ticker ?? "";
    const headline = fm.headline ?? "";
    const summary = content.match(/## Summary\n([\s\S]*?)(?:\n##|$)/)?.[1]?.trim() ?? "";

    if (fm.relevance === "0.00" && ticker) {
      const newRelevance = computeHeuristicRelevance(ticker, headline, summary);
      content = content.replace(/^relevance: 0\.00$/m, `relevance: ${newRelevance.toFixed(2)}`);
      modified = true;
      relevanceFixed++;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, "utf-8");
    }
  }

  console.log(`\nRepair complete: ${repaired} notes repaired, ${relevanceFixed} relevance scores recomputed.`);
}

repairVault();