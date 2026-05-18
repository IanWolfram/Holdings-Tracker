import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { runGraphPass } from "../world-brain/graph";
import { SYSTEM_USER_ID } from "../lib/constants";
import { getVaultStore, type VaultStore } from "../lib/vault/store";

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

async function loadProfiles(
  store: VaultStore
): Promise<Record<string, { sector?: string }>> {
  const profiles: Record<string, { sector?: string }> = {};
  const files = (await store.list("news")).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const raw = await store.read(`news/${file}`);
    if (!raw) continue;
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm: Record<string, string> = {};
    for (const line of fmMatch[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    }
    const ticker = fm.ticker?.toUpperCase();
    const sector = fm.sector;
    if (!ticker) continue;
    if (!profiles[ticker] || (!profiles[ticker].sector && sector)) {
      profiles[ticker] = { sector };
    }
  }
  return profiles;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const store = await getVaultStore(SYSTEM_USER_ID);

  const profiles = await loadProfiles(store);
  const tickers = Object.keys(profiles);
  console.log(`[world-graph] Tickers: ${tickers.join(", ") || "(none)"}`);

  await runGraphPass(store, profiles, tickers);
  console.log("[world-graph] Done.");
}

main().catch((err) => {
  console.error("[world-graph] Fatal error:", err);
  process.exit(1);
});