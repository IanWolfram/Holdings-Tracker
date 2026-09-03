/**
 * Cross-process per-user sweep lock (the `sweep_locks` table).
 *
 * The in-memory guard in progress.ts only covers one process; manual sweeps run
 * in the Next.js process while cron sweeps run in pulse-worker, so mutual
 * exclusion has to live in Postgres. Claiming is a conditional UPDATE — the
 * database serializes concurrent claimers, so exactly one wins.
 *
 * Locks go stale after STALE_LOCK_MS (crashed process) but a healthy long sweep
 * keeps its claim fresh via touchSweepLock() heartbeats, so "stale" really means
 * "holder died", not "sweep is slow".
 */
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

/** Matches the job-runner's stale-claim convention. */
const STALE_LOCK_MS = 30 * 60 * 1000;
/** Heartbeats more often than this are dropped (cheap no-op). */
const HEARTBEAT_MIN_GAP_MS = 60 * 1000;

export interface SweepLock {
  userId: string;
  token: string;
}

const lastHeartbeat = new Map<string, number>();

/**
 * Try to claim the sweep lock for a user. Returns a lock handle on success,
 * null when another process holds a fresh claim. Fail-closed on DB errors —
 * a sweep can't do anything useful without the database anyway.
 */
export async function acquireSweepLock(userId: string): Promise<SweepLock | null> {
  const sb = createServiceClient();
  const token = randomUUID();
  const staleIso = new Date(Date.now() - STALE_LOCK_MS).toISOString();

  // Ensure the row exists without disturbing an existing claim.
  const { error: upsertError } = await sb
    .from("sweep_locks")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (upsertError) {
    console.error("[run-lock] lock row upsert failed:", upsertError.message);
    return null;
  }

  const { data, error } = await sb
    .from("sweep_locks")
    .update({
      claimed_at: new Date().toISOString(),
      claimed_by: token,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .or(`claimed_at.is.null,claimed_at.lt.${staleIso}`)
    .select("user_id");

  if (error) {
    console.error("[run-lock] claim failed:", error.message);
    return null;
  }
  if (!data || data.length === 0) return null; // someone else holds it

  return { userId, token };
}

/**
 * Keep a held lock fresh during a long sweep. Throttled internally; call it as
 * often as convenient (e.g. once per analyzed position). Only bumps the row if
 * we still own it (token match), so a reclaimed-after-stale lock is untouched.
 */
export function touchSweepLock(lock: SweepLock): void {
  const now = Date.now();
  const prev = lastHeartbeat.get(lock.token) ?? 0;
  if (now - prev < HEARTBEAT_MIN_GAP_MS) return;
  lastHeartbeat.set(lock.token, now);

  const sb = createServiceClient();
  void sb
    .from("sweep_locks")
    .update({ claimed_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
    .eq("user_id", lock.userId)
    .eq("claimed_by", lock.token)
    .then(({ error }) => {
      if (error) console.error("[run-lock] heartbeat failed:", error.message);
    });
}

/** Release a held lock. Token-guarded: never clears a claim we no longer own. */
export async function releaseSweepLock(lock: SweepLock): Promise<void> {
  lastHeartbeat.delete(lock.token);
  const sb = createServiceClient();
  const { error } = await sb
    .from("sweep_locks")
    .update({ claimed_at: null, claimed_by: null, updated_at: new Date().toISOString() })
    .eq("user_id", lock.userId)
    .eq("claimed_by", lock.token);
  if (error) console.error("[run-lock] release failed:", error.message);
}
