/**
 * Combined ingest orchestrator — runs the House + Senate ingesters against the
 * service-role client. Shared by the CLI (`scripts/ingest-congress.ts`) and the
 * daily cron (`instrumentation.node.ts`) so both take the identical path.
 *
 * Incremental by default: each ingester diffs against `congress_ingest_log` and
 * only fetches/parses filings it hasn't seen. The 30–45 day STOCK Act filing lag
 * makes a daily cadence more than sufficient.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { ingestHouse, type HouseIngestStats } from "./house";
import { ingestSenate, type SenateIngestStats } from "./senate";

export interface CongressIngestOptions {
  houseYears?: number[]; // default: current year (ingester default)
  senateSince?: string; // MM/DD/YYYY, default: 01/01 of last year (ingester default)
  limit?: number; // cap per chamber (testing)
  force?: boolean; // ignore the ingest log
  houseOnly?: boolean;
  senateOnly?: boolean;
  logger?: (msg: string) => void;
}

export interface CongressIngestResult {
  house?: HouseIngestStats;
  senate?: SenateIngestStats;
}

export async function runCongressIngest(
  opts: CongressIngestOptions = {},
): Promise<CongressIngestResult> {
  const supabase = createServiceClient();
  const logger = opts.logger ?? ((m: string) => console.log(m));
  const result: CongressIngestResult = {};

  // Isolate the two chambers: one source being down (e.g. a not-yet-published
  // new-year House zip) must not prevent the other from ingesting.
  if (!opts.senateOnly) {
    try {
      result.house = await ingestHouse({
        supabase,
        years: opts.houseYears,
        limit: opts.limit,
        force: opts.force,
        logger,
      });
    } catch (e) {
      logger(`[house] ingest failed: ${(e as Error).message}`);
    }
  }
  if (!opts.houseOnly) {
    try {
      result.senate = await ingestSenate({
        supabase,
        since: opts.senateSince,
        limit: opts.limit,
        force: opts.force,
        logger,
      });
    } catch (e) {
      logger(`[senate] ingest failed: ${(e as Error).message}`);
    }
  }
  return result;
}
