/**
 * Scheduled prediction resolution for the multi-tenant (Supabase) backend.
 *
 * Predictions previously only resolved when a user manually ran an agent sweep,
 * so horizons drifted (a "1d" forecast resolved days late) and dozens sat
 * `pending` forever. This module resolves every user's eligible predictions on a
 * cron, against the horizon-date close (see `resolveEligiblePredictions`), so the
 * resolution window stays accurate without manual intervention.
 */
import { getDailyBars } from "../lib/marketdata/prices";
import { getVaultStore } from "../lib/vault/store";
import { createServiceClient } from "../lib/supabase/server";
import { resolveEligiblePredictions } from "./predictions";
import { updateCalibration } from "./calibration";
import { appendForecasterSnapshot } from "./forecaster-metrics";

const PREDICTION_PATH_RE = /^predictions\/([A-Z0-9.\-]+?)-(\d+)d\.json$/;

/**
 * Resolve all eligible pending predictions for a single user across every ticker
 * that has a predictions file, then refresh that user's calibration report.
 * Tickers come from the prediction files themselves (not live positions) so this
 * works even when E*TRADE tokens are absent.
 */
export async function resolvePendingForUser(
  userId: string,
  nowMs: number = Date.now()
): Promise<{ resolved: number; expired: number; tickers: number }> {
  const store = await getVaultStore(userId);
  const notes = await store.listNotes("predictions/");

  const tickers = new Set<string>();
  for (const note of notes) {
    const match = note.path.match(PREDICTION_PATH_RE);
    if (match) tickers.add(match[1]);
  }

  let resolved = 0;
  let expired = 0;
  for (const ticker of tickers) {
    const bars = await getDailyBars(ticker).catch(() => []);
    if (!bars.length) {
      // Still run the resolver: with no bars and no price it can only expire
      // long-overdue pendings, which is exactly what keeps delisted/renamed
      // tickers from sitting pending forever.
      console.warn(`[resolve-all] No bars for ${ticker} (${userId}) — expiry-only pass`);
    }
    const result = await resolveEligiblePredictions(
      store, ticker, null, nowMs, undefined, bars.length ? bars : null
    );
    resolved += result.resolved;
    expired += result.expired;
  }

  if (resolved > 0) {
    try {
      await updateCalibration(store);
    } catch (err) {
      console.error(`[resolve-all] Calibration update failed for ${userId}:`, (err as Error).message);
    }
    // Append a directional-precision snapshot so the forecaster's edge (and its
    // CI tightening as samples accumulate) is tracked over time in _metrics/.
    try {
      const snap = await appendForecasterSnapshot(store, nowMs);
      if (snap) {
        console.info(
          `[resolve-all] ${userId} directional precision ${(snap.precision * 100).toFixed(1)}% ` +
            `(n=${snap.n}, 95% CI ${(snap.ci95[0] * 100).toFixed(0)}–${(snap.ci95[1] * 100).toFixed(0)}%, ` +
            `edge ${snap.edgePct >= 0 ? "+" : ""}${snap.edgePct.toFixed(2)}%/call)`,
        );
      }
    } catch (err) {
      console.error(`[resolve-all] Snapshot failed for ${userId}:`, (err as Error).message);
    }
  }

  return { resolved, expired, tickers: tickers.size };
}

/**
 * Resolve eligible predictions for every user that has any prediction files.
 * Intended to be driven by the daily cron in `instrumentation.node.ts`.
 */
export async function resolveAllUsersPending(
  nowMs: number = Date.now()
): Promise<{ users: number; resolved: number; expired: number }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("vault_notes")
    .select("user_id")
    .like("path", "predictions/%");

  if (error || !data) {
    console.error("[resolve-all] Failed to list prediction owners:", error?.message);
    return { users: 0, resolved: 0, expired: 0 };
  }

  const userIds = [...new Set(data.map((row) => row.user_id as string))];
  let resolved = 0;
  let expired = 0;
  for (const userId of userIds) {
    try {
      const result = await resolvePendingForUser(userId, nowMs);
      resolved += result.resolved;
      expired += result.expired;
    } catch (err) {
      console.error(`[resolve-all] User ${userId} failed:`, (err as Error).message);
    }
  }

  return { users: userIds.length, resolved, expired };
}
