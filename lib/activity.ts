/**
 * Presence tracking: stamps user_activity.last_seen_at so the agent job runner
 * can boost story-analysis cadence for users who are actively on the app
 * (lib/agent/job-runner.ts reads it from the worker process via Supabase).
 *
 * Throttled in-memory per user so a polling dashboard doesn't turn into a DB
 * write per request. Single-process assumption, same as lib/rate-limit.ts —
 * a second web process would just write a little more often, which is fine.
 */
import { createServiceClient } from "@/lib/supabase/server";

const TOUCH_INTERVAL_MS = 60_000;
const lastTouch = new Map<string, number>();

/** Fire-and-forget; never throws — presence is best-effort. */
export function touchLastSeen(userId: string): void {
  const now = Date.now();
  const prev = lastTouch.get(userId) ?? 0;
  if (now - prev < TOUCH_INTERVAL_MS) return;
  lastTouch.set(userId, now);

  const sb = createServiceClient();
  void sb
    .from("user_activity")
    .upsert(
      { user_id: userId, last_seen_at: new Date(now).toISOString() },
      { onConflict: "user_id" }
    )
    .then(({ error }) => {
      if (error) console.error("[activity] last_seen touch failed:", error.message);
    });
}
