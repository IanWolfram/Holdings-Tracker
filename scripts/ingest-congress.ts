/**
 * Congressional trade ingester (CLI).
 *
 * Downloads House Clerk PTRs + Senate eFD reports, parses them, joins the roster
 * for party/bioguide, and upserts into `congress_trades`. Incremental by default
 * (skips already-logged filings); use `--force` to reprocess.
 *
 * Usage:
 *   npm run congress:ingest                       # daily incremental (current year)
 *   npm run congress:ingest -- --backfill         # last ~18mo, both chambers
 *   npm run congress:ingest -- --house-only --limit 20
 *   npm run congress:ingest -- --years 2025,2026 --since 01/01/2025 --force
 *
 * Bypasses Next instrumentation, so it hydrates secrets itself. The Supabase
 * connection vars come from the real env (loaded via --env-file=.env.local in
 * the npm script); everything else is filled from app_secrets.
 */

import { hydrateSecrets } from "../lib/secrets";
import { runCongressIngest, type CongressIngestOptions } from "../lib/congress/ingest";

function parseArgs(argv: string[]): CongressIngestOptions & { backfill: boolean } {
  const opts: CongressIngestOptions & { backfill: boolean } = { backfill: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--backfill":
        opts.backfill = true;
        break;
      case "--force":
        opts.force = true;
        break;
      case "--house-only":
        opts.houseOnly = true;
        break;
      case "--senate-only":
        opts.senateOnly = true;
        break;
      case "--limit":
        opts.limit = parseInt(argv[++i], 10);
        break;
      case "--years":
        opts.houseYears = argv[++i].split(",").map((y) => parseInt(y.trim(), 10)).filter(Number.isFinite);
        break;
      case "--since":
        opts.senateSince = argv[++i];
        break;
      default:
        console.warn(`[congress:ingest] ignoring unknown arg: ${a}`);
    }
  }
  return opts;
}

async function main() {
  await hydrateSecrets();

  const { backfill, ...opts } = parseArgs(process.argv.slice(2));
  if (backfill) {
    const year = new Date().getUTCFullYear();
    opts.houseYears ??= year > 2025 ? [2025, year] : [2025];
    opts.senateSince ??= "01/01/2025";
  }

  const startedAt = Date.now();
  console.log(`[congress:ingest] starting${backfill ? " (backfill)" : ""}…`);
  const result = await runCongressIngest(opts);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n[congress:ingest] done in ${elapsed}s`);
  if (result.house) console.log("  house:", JSON.stringify(result.house));
  if (result.senate) console.log("  senate:", JSON.stringify(result.senate));

  const rowErrors = (result.house?.errors ?? 0) + (result.senate?.errors ?? 0);
  const houseFailed = !opts.senateOnly && !result.house;
  const senateFailed = !opts.houseOnly && !result.senate;
  if (houseFailed || senateFailed) {
    console.error(`[congress:ingest] chamber failure (house=${!houseFailed} senate=${!senateFailed})`);
  }
  process.exit(rowErrors > 0 || houseFailed || senateFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("[congress:ingest] fatal:", err);
  process.exit(1);
});
