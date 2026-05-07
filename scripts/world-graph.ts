import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { runGraphPass } from "../world-brain/graph";
import { FsVaultStore } from "../lib/vault/store";

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
  store: FsVaultStore
): Promise<Record<string, { sector?: string }>> {
  const profiles: Record<string, { sector?: string }> = {};
  const notes = await store.listNotes("news/");
  for (const note of notes) {
    const fm = note.frontmatter;
    const ticker = typeof fm.ticker === "string" ? fm.ticker.toUpperCase() : null;
    const sector = typeof fm.sector === "string" ? fm.sector : undefined;
    if (!ticker) continue;
    if (!profiles[ticker] || (!profiles[ticker].sector && sector)) {
      profiles[ticker] = { sector };
    }
  }
  return profiles;
}

async function main(): Promise<void> {
  loadLocalEnv();
  const vaultPathRaw = process.env.WORLD_VAULT_PATH ?? "./world-vault";
  const store = new FsVaultStore(vaultPathRaw);

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