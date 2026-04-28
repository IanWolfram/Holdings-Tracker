import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { resolveVaultPath } from "../lib/constants";
import { runGraphPass } from "../world-brain/graph";

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key || key in process.env) continue;
    process.env[key] = rest.join("=").trim();
  }
}

interface Profile {
  sector?: string;
}

function loadProfiles(): Record<string, Profile> {
  const profiles: Record<string, Profile> = {};
  const fs = require("fs");
  const path = require("path");
  const vaultRaw = process.env.WORLD_VAULT_PATH ?? "./world-vault";
  const vault = resolveVaultPath(vaultRaw) ?? vaultRaw;
  const newsDir = path.join(vault, "news");
  if (!fs.existsSync(newsDir)) return profiles;

  for (const file of fs.readdirSync(newsDir)) {
    if (!file.endsWith(".md")) continue;
    try {
      const content: string = fs.readFileSync(path.join(newsDir, file), "utf-8");
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const tickerMatch = fmMatch[1].match(/ticker:\s*(\S+)/);
      const sectorMatch = fmMatch[1].match(/sector:\s*(.+)/);
      if (!tickerMatch) continue;
      const ticker = tickerMatch[1].toUpperCase();
      const sector = sectorMatch?.[1]?.trim().replace(/^["']|["']$/g, "");
      if (!profiles[ticker] || (!profiles[ticker].sector && sector)) {
        profiles[ticker] = { sector };
      }
    } catch {
      // ignore per-file errors
    }
  }
  return profiles;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const vaultPathRaw = process.env.WORLD_VAULT_PATH ?? "./world-vault";
  const vaultPath = resolveVaultPath(vaultPathRaw) ?? vaultPathRaw;

  const profiles = loadProfiles();
  const tickers = Object.keys(profiles);
  console.log(`[world-graph] Tickers: ${tickers.join(", ") || "(none)"}`);

  await runGraphPass(vaultPath, profiles, tickers);
  console.log("[world-graph] Done.");
}

main().catch((err) => {
  console.error("[world-graph] Fatal error:", err);
  process.exit(1);
});
