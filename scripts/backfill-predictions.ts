/**
 * One-time backfill: copy predictions from the legacy JSON blobs in vault_notes
 * (`predictions/<TICKER>-<H>d.json`) into the relational `predictions` table.
 *
 * Idempotent — rows upsert by (user_id, id), so re-running is safe. Dry-run by
 * default; pass --apply to write. Does NOT delete the source JSON (leave that
 * for after a production soak once the table is confirmed authoritative).
 *
 *   npx tsx --env-file=.env.local scripts/backfill-predictions.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/backfill-predictions.ts --apply  # write
 */
import { createServiceClient } from "../lib/supabase/server";
import { parsePredictions } from "../types/predictions";
import { SupabasePredictionStore } from "../lib/predictions/store";
import type { TickerPrediction } from "../types/predictions";

const PAGE = 1000;

async function main() {
  const apply = process.argv.includes("--apply");
  const sb = createServiceClient();

  // Page all prediction files across all users.
  const files: { user_id: string; path: string; body: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("vault_notes")
      .select("user_id, path, body")
      .like("path", "predictions/%")
      .order("user_id", { ascending: true })
      .order("path", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[backfill] read failed:", error.message);
      process.exit(1);
    }
    files.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  // Parse + group by user.
  const byUser = new Map<string, TickerPrediction[]>();
  let totalParsed = 0;
  let totalDropped = 0;
  for (const f of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(f.body);
    } catch {
      console.warn(`[backfill] unparseable JSON: ${f.user_id}/${f.path}`);
      continue;
    }
    const { predictions, dropped } = parsePredictions(raw);
    totalParsed += predictions.length;
    totalDropped += dropped;
    if (dropped > 0) console.warn(`[backfill] ${f.path} (${f.user_id}): dropped ${dropped} corrupt row(s)`);
    const bucket = byUser.get(f.user_id) ?? [];
    bucket.push(...predictions);
    byUser.set(f.user_id, bucket);
  }

  console.log(
    `[backfill] ${files.length} file(s) across ${byUser.size} user(s) → ${totalParsed} valid prediction(s)` +
      (totalDropped ? `, ${totalDropped} dropped` : ""),
  );
  for (const [userId, preds] of byUser) {
    console.log(`  ${userId}: ${preds.length}`);
  }

  if (!apply) {
    console.log("[backfill] DRY RUN — pass --apply to write to the predictions table.");
    return;
  }

  let written = 0;
  for (const [userId, preds] of byUser) {
    const ps = new SupabasePredictionStore(userId, sb);
    // save() upserts each row by its own ticker/horizon, so the ticker/horizon
    // args are ignored — pass placeholders.
    await ps.save("", 0, preds);
    written += preds.length;
    console.log(`  wrote ${preds.length} for ${userId}`);
  }
  console.log(`[backfill] DONE — upserted ${written} prediction(s).`);
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
