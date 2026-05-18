/**
 * Migrate world-vault markdown files into the Supabase vault_notes table.
 *
 * Walks the world-vault/ directory, parses frontmatter from each .md file,
 * and inserts it as a vault_notes row for the given user.
 *
 * Idempotent: upserts on (user_id, path) unique key.
 *
 * Usage:
 *   npx tsx scripts/migrate-vault-to-supabase.ts <user-id> [vault-dir]
 *   npx tsx scripts/migrate-vault-to-supabase.ts --system [vault-dir]
 *   npx tsx scripts/migrate-vault-to-supabase.ts --dry-run <user-id> [vault-dir]
 *
 * Flags:
 *   --system   Use the SYSTEM_USER_ID service account instead of a real user
 *   --dry-run  Scan and report but do not insert into the database
 *
 * Requires either:
 *   DATABASE_URL (direct Postgres — preferred when SUPABASE_SERVICE_ROLE_KEY unavailable)
 *   or
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, relative } from "path";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

config({ path: resolve(process.cwd(), ".env.local") });

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const useSystem = args.includes("--system");
const positional = args.filter((a) => !a.startsWith("--"));

const USER_ID = useSystem ? SYSTEM_USER_ID : positional[0];
const VAULT_DIR = positional[useSystem ? 0 : 1] || "./world-vault";

if (!USER_ID) {
  console.error("Usage: npx tsx scripts/migrate-vault-to-supabase.ts <user-id> [vault-dir]");
  console.error("       npx tsx scripts/migrate-vault-to-supabase.ts --system [vault-dir]");
  console.error("       npx tsx scripts/migrate-vault-to-supabase.ts --dry-run <user-id> [vault-dir]");
  process.exit(1);
}

if (dryRun) {
  console.log("[dry-run] No rows will be inserted.");
}

interface ParseResult {
  frontmatter: Record<string, unknown>;
  body: string;
}

function parseFrontmatter(content: string): ParseResult {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const fm: Record<string, unknown> = {};
  const rawFm = match[1];
  for (const line of rawFm.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();
    try {
      value = JSON.parse(value as string);
    } catch {
      // Keep as string
    }
    fm[key] = value;
  }

  return { frontmatter: fm, body: match[2] };
}

function walkDir(dir: string, base: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".")) continue;
      results.push(...walkDir(fullPath, base));
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".json")) {
      results.push(relative(base, fullPath));
    }
  }
  return results;
}

interface VaultRow {
  user_id: string;
  path: string;
  body: string;
  frontmatter: Record<string, unknown>;
  updated_at: string;
}

async function migrateViaPg(rows: VaultRow[]): Promise<{ inserted: number; errors: number }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not set");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  try {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let paramIdx = 1;

      for (const row of batch) {
        const p = (n: number) => `$${paramIdx + n}`;
        placeholders.push(`(${p(0)}, ${p(1)}, ${p(2)}, ${p(3)}, ${p(4)})`);
        values.push(row.user_id, row.path, row.body, JSON.stringify(row.frontmatter), row.updated_at);
        paramIdx += 5;
      }

      const sql = `
        INSERT INTO vault_notes (user_id, path, body, frontmatter, updated_at)
        VALUES ${placeholders.join(", ")}
        ON CONFLICT (user_id, path) DO UPDATE SET
          body = EXCLUDED.body,
          frontmatter = EXCLUDED.frontmatter,
          updated_at = EXCLUDED.updated_at
      `;

      try {
        await client.query(sql, values);
        inserted += batch.length;
      } catch (err) {
        console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err);
        errors += batch.length;
      }

      if ((i + BATCH_SIZE) % 500 === 0) {
        console.log(`  Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
      }
    }
  } finally {
    await client.end();
  }

  return { inserted, errors };
}

async function migrateViaSupabase(rows: VaultRow[]): Promise<{ inserted: number; errors: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase env vars not set");

  const supabase = createClient(supabaseUrl, serviceKey);
  let inserted = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("vault_notes").upsert(batch, {
      onConflict: "user_id,path",
    });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }

    if ((i + BATCH_SIZE) % 500 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
    }
  }

  return { inserted, errors };
}

async function main() {
  const resolvedVault = resolve(process.cwd(), VAULT_DIR);

  console.log(`Scanning ${resolvedVault}...`);
  const files = walkDir(resolvedVault, resolvedVault);
  console.log(`Found ${files.length} files`);

  const rows: VaultRow[] = files.map((filePath) => {
    const fullPath = join(resolvedVault, filePath);
    const content = readFileSync(fullPath, "utf-8");
    const { frontmatter, body } = parseFrontmatter(content);

    return {
      user_id: USER_ID,
      path: filePath,
      body,
      frontmatter,
      updated_at: statSync(fullPath).mtime.toISOString(),
    };
  });

  if (dryRun) {
    console.log(`\n[dry-run] Would migrate ${rows.length} rows for user ${USER_ID}:`);
    for (const row of rows.slice(0, 10)) {
      console.log(`  ${row.path} (${(row.body.length / 1024).toFixed(1)} KB)`);
    }
    if (rows.length > 10) console.log(`  ... and ${rows.length - 10} more`);
    return;
  }

  const usePg = !!process.env.DATABASE_URL;
  console.log(`Using ${usePg ? "DATABASE_URL (direct Postgres)" : "Supabase JS client"}...`);

  const result = usePg
    ? await migrateViaPg(rows)
    : await migrateViaSupabase(rows);

  console.log(`\nMigration complete:`);
  console.log(`  Inserted/updated: ${result.inserted}`);
  console.log(`  Errors: ${result.errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});