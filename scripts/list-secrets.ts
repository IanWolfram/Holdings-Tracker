/**
 * Inspect the Supabase `app_secrets` table — the single source of truth for API
 * keys (FINNHUB, DeepSeek, E*TRADE consumer creds, …) that `lib/secrets.ts`
 * hydrates into `process.env` at boot.
 *
 * Connection vars come from the real environment (`process.env`); this script
 * never parses `.env.local` itself. Populate them at runtime, e.g.:
 *
 *   npx tsx --env-file=.env.local scripts/list-secrets.ts
 *   npx tsx --env-file=.env.local scripts/list-secrets.ts --reveal   # show values
 *
 * Values are masked by default so secrets don't land in terminal scrollback or
 * logs. Pass `--reveal` to print them in full.
 */
import { createServiceClient } from "../lib/supabase/server";

function mask(value: string): string {
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "[list-secrets] Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in process.env.\n" +
        "Run with the runtime loading them, e.g. `npx tsx --env-file=.env.local scripts/list-secrets.ts`.",
    );
    process.exit(1);
  }

  const reveal = process.argv.includes("--reveal");
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("app_secrets").select("key, value").order("key");

  if (error) {
    console.error("[list-secrets] Failed to read app_secrets:", error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  console.info(`[list-secrets] ${rows.length} secret(s) in app_secrets:\n`);
  for (const row of rows) {
    const key = row.key as string;
    const value = (row.value as string | null) ?? "";
    console.info(`  ${key.padEnd(28)} ${reveal ? value : mask(value)}`);
  }
}

main().catch((err) => {
  console.error("[list-secrets] Error:", (err as Error).message);
  process.exit(1);
});
