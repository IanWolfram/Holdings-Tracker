import fs from "fs";
import path from "path";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { resolveVaultPath } from "../lib/constants";
import { classifyCatalystTypes } from "../world-brain/catalyst-classifier";
import { CATALYST_TYPES, type CatalystType } from "../types/predictions";

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

function splitFrontmatter(content: string): { frontmatter: string; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  return { frontmatter: match[1], body: match[2] };
}

function frontmatterHasCatalysts(frontmatter: string): boolean {
  return /\bcatalystTypes\s*:/.test(frontmatter);
}

function parseScalarField(frontmatter: string, key: string): string | null {
  const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, "m");
  const m = frontmatter.match(re);
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function readReason(body: string): string {
  const match = body.match(/##\s+AI Analysis\n([\s\S]*?)(?:\n##|$)/);
  if (!match) return "";
  const reason = match[1].trim();
  if (reason === "_No analysis available._") return "";
  return reason;
}

function readHeadline(body: string, fallback: string): string {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fallback;
}

function injectCatalystsIntoFrontmatter(frontmatter: string, types: CatalystType[]): string {
  const lines = frontmatter.split("\n");
  const tagsIdx = lines.findIndex((line) => /^tags\s*:/.test(line));
  const insertAt = tagsIdx >= 0 ? tagsIdx : lines.length;
  const block = ["catalystTypes:", ...types.map((t) => `  - ${t}`)];
  lines.splice(insertAt, 0, ...block);
  return lines.join("\n");
}

function rewriteFile(filePath: string, frontmatter: string, body: string): void {
  const content = `---\n${frontmatter}\n---\n${body}`;
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, filePath);
}

async function main(): Promise<void> {
  loadLocalEnv();
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;

  const vaultPathRaw = process.env.WORLD_VAULT_PATH ?? "./world-vault";
  const vaultPath = resolveVaultPath(vaultPathRaw) ?? vaultPathRaw;
  const newsDir = path.join(vaultPath, "news");
  if (!fs.existsSync(newsDir)) {
    throw new Error(`News directory not found: ${newsDir}`);
  }

  const files = fs.readdirSync(newsDir).filter((f) => f.endsWith(".md")).sort();
  let scanned = 0;
  let alreadyTagged = 0;
  let tagged = 0;
  let unparseable = 0;
  const distribution = new Map<CatalystType, number>();

  for (const file of files) {
    scanned += 1;
    const filePath = path.join(newsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const split = splitFrontmatter(content);
    if (!split) {
      unparseable += 1;
      continue;
    }
    if (frontmatterHasCatalysts(split.frontmatter)) {
      alreadyTagged += 1;
      continue;
    }

    const verdict = parseScalarField(split.frontmatter, "verdict") ?? "";
    const headline = readHeadline(split.body, file);
    const reason = readReason(split.body);

    const types = classifyCatalystTypes({ headline, reason, verdict });
    if (!types || types.length === 0) continue;

    for (const t of types) distribution.set(t, (distribution.get(t) ?? 0) + 1);
    tagged += 1;

    if (apply) {
      const updated = injectCatalystsIntoFrontmatter(split.frontmatter, types);
      rewriteFile(filePath, updated, split.body);
    }
  }

  const modeLabel = dryRun ? "DRY RUN" : "APPLY";
  console.log(`[backfill-news] Mode: ${modeLabel}`);
  console.log(`[backfill-news] Scanned: ${scanned}`);
  console.log(`[backfill-news] Already tagged: ${alreadyTagged}`);
  console.log(`[backfill-news] Newly tagged: ${tagged}`);
  console.log(`[backfill-news] Unparseable frontmatter: ${unparseable}`);
  console.log("[backfill-news] Distribution:");
  for (const t of CATALYST_TYPES) {
    const count = distribution.get(t) ?? 0;
    if (count > 0) console.log(`  - ${t}: ${count}`);
  }
  if (dryRun) {
    console.log("[backfill-news] Run with --apply to persist changes.");
  }
}

main().catch((err) => {
  console.error("[backfill-news] Fatal error:", err);
  process.exit(1);
});
