import fs from "fs";
import path from "path";
import { resolveVaultPath } from "./constants";
import type { Verdict, Classification } from "@/types/news.types";

export interface VaultEntry extends Classification {
  filePath: string;
  ticker: string;
  headline: string;
  summary: string;
  datetime: number;
  source: string;
}

let vaultIndex: Map<string, VaultEntry> | null = null;
let lastIndexTime = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Parses frontmatter from an Obsidian note.
 */
function parseFrontmatter(content: string): Record<string, string> {
  const lines = content.split("\n");
  const fm: Record<string, string> = {};
  let inFm = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "---") {
      if (!inFm) { inFm = true; continue; }
      else break;
    }
    if (inFm) {
      const splitIdx = line.indexOf(":");
      if (splitIdx !== -1) {
        const key = line.slice(0, splitIdx).trim();
        const val = line.slice(splitIdx + 1).trim().replace(/^["']|["']$/g, "");
        fm[key] = val;
      }
    }
  }
  return fm;
}

function parseCatalystTypes(content: string): Classification["catalystTypes"] {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return undefined;

  const blockMatch = fmMatch[1].match(/\bcatalystTypes\s*:\s*\n((?:\s*-\s*[^\n]+\n?)*)/);
  if (!blockMatch) return undefined;

  const values = blockMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);

  return values.length > 0 ? (values as Classification["catalystTypes"]) : undefined;
}

/**
 * Scans the World Vault and builds an in-memory index of news stories by URL.
 */
export async function getVaultIndex(vaultPath: string): Promise<Map<string, VaultEntry>> {
  const now = Date.now();
  if (vaultIndex && (now - lastIndexTime < CACHE_TTL)) {
    return vaultIndex;
  }

  const resolvedPath = resolveVaultPath(vaultPath);
  if (!resolvedPath) return new Map();

  const newsDir = path.join(resolvedPath, "news");
  if (!fs.existsSync(newsDir)) return new Map();

  const newIndex = new Map<string, VaultEntry>();
  try {
    const files = fs.readdirSync(newsDir).filter(f => f.endsWith(".md"));
    for (const file of files) {
      const filePath = path.join(newsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const fm = parseFrontmatter(content);
      
      const url = fm.url;
      if (url) {
        const catalystTypes = parseCatalystTypes(content);
        let reason = fm.reason;
        if (!reason) {
          const analysisMatch = content.match(/## AI Analysis\n([\s\S]*?)(?:\n##|$)/);
          if (analysisMatch) reason = analysisMatch[1].trim();
        }

        // Extract headline: prefer frontmatter, fall back to H1
        let headline = fm.headline || "";
        if (!headline) {
          const h1Match = content.match(/\n# (.+)/);
          if (h1Match) headline = h1Match[1].trim();
        }

        // Extract summary from ## Summary section
        let summary = "";
        const summaryMatch = content.match(/## Summary\n([\s\S]*?)(?:\n##|$)/);
        if (summaryMatch) summary = summaryMatch[1].trim();

        // Parse date to unix timestamp
        let datetime = 0;
        if (fm.date) {
          const d = new Date(fm.date);
          if (!isNaN(d.getTime())) datetime = Math.floor(d.getTime() / 1000);
        }

        newIndex.set(url, {
          verdict: fm.verdict as Verdict,
          confidence: parseFloat(fm.confidence || "0.9"),
          reason: reason || undefined,
          relevanceScore: parseFloat(fm.relevance || "0"),
          originCountryCode: fm.country || null,
          catalystTypes,
          classifiedAt: fm.date || new Date().toISOString(),
          isAnalyzed: fm.verified === "true",
          analysisFailed: fm.analysisFailed === "true",
          fromVault: true,
          filePath,
          ticker: fm.ticker || "",
          headline,
          summary,
          datetime,
          source: fm.source || "unknown",
        });
      }
    }
  } catch (err) {
    console.error("[vault-index] Failed to build index:", err);
  }

  vaultIndex = newIndex;
  lastIndexTime = now;
  return newIndex;
}

/**
 * Updates the index with a single story without a full re-scan.
 */
export function updateVaultIndex(url: string, entry: VaultEntry): void {
  if (vaultIndex) {
    vaultIndex.set(url, entry);
  }
}

/**
 * Clear the cache to force a re-scan.
 */
export function invalidateVaultIndex(): void {
  vaultIndex = null;
}
