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
import { acquireSweepLock, releaseSweepLock } from "../lib/agent/run-lock";
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
  // Take the same per-user lock a sweep holds. Both the resolve cron and a
  // sweep do read-modify-write on the user's predictions/*.json files; without
  // this, a sweep running in the Next.js process and this cron running in
  // pulse-worker can race and lose one another's writes. If a sweep holds the
  // lock (or the DB is unreachable), skip this user — resolution is idempotent
  // and retried on the next tick, and an in-flight sweep resolves inline anyway.
  const lock = await acquireSweepLock(userId);
  if (!lock) {
    return { resolved: 0, expired: 0, tickers: 0 };
  }
  try {
    return await resolvePendingForUserLocked(userId, nowMs);
  } finally {
    await releaseSweepLock(lock);
  }
}

async function resolvePendingForUserLocked(
  userId: string,
  nowMs: number
): Promise<{ resolved: number; expired: number; tickers: number }> {
  const store = await getVaultStore(userId);

  // Enumerate this user's tickers from the predictions table when available
  // (SELECT DISTINCT ticker), else from the legacy prediction-file paths.
  const tickers = new Set<string>();
  const ps = store.predictionStore?.();
  if (ps) {
    for (const t of await ps.distinctTickers()) tickers.add(t);
  } else {
    const notes = await store.listNotes("predictions/");
    for (const note of notes) {
      const match = note.path.match(PREDICTION_PATH_RE);
      if (match) tickers.add(match[1]);
    }
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
  // Enumerate prediction owners from the predictions table, paging past
  // PostgREST's 1,000-row cap. Ordered by user_id so pages are stable; many rows
  // per user collapse into the Set. (Predictions moved out of vault_notes into
  // their own table — see the predictions migration.)
  const supabase = createServiceClient();
  const PAGE_SIZE = 1000;
  const owners = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("predictions")
      .select("user_id")
      .order("user_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("[resolve-all] Failed to list prediction owners:", error.message);
      return { users: 0, resolved: 0, expired: 0 };
    }
    for (const row of data ?? []) owners.add(row.user_id as string);
    if (!data || data.length < PAGE_SIZE) break;
  }

  const userIds = [...owners];
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
