/**
 * Agent → user signal notifications.
 *
 * After a sweep produces directional forecasts, the strong ones become a
 * user-facing notification (a TopBar speech bubble) AND an assistant message in
 * a dedicated "Agent Signals" conversation so the user can read it in the chat
 * thread on /agent.
 *
 * Compliance: we surface SENTIMENT, never trade instructions. All wording routes
 * through VERDICT_LABEL framing (UP→"Positive", DOWN→"Negative") and carries the
 * standard informational-only disclaimer — see types/news.types.ts.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { VERDICT_LABEL } from "@/types/news.types";
import { computeHorizonDirectionalStats } from "@/world-brain/forecaster-metrics";
import { debug } from "../debug";

/** A forecast strong enough to surface to the user. */
export interface SignalCandidate {
  ticker: string;
  direction: "UP" | "DOWN";
  magnitudePct: number;
  /** Calibration-grounded confidence (what the prediction card shows). */
  confidence: number;
  /** The model's stated conviction before calibration shrink. */
  rawConfidence?: number;
  horizonDays: number;
  reasoning: string;
}

/** Minimal read surface emitSignals needs from the user's vault store. */
type MetricsStore = { listNotes(prefix: string): Promise<{ body: string }[]> };

/** Minimum confidence for a directional forecast to surface as a signal. */
export const SIGNAL_CONFIDENCE_MIN = 0.6;
/** Only short-horizon forecasts are actionable enough to notify on. */
const SIGNAL_HORIZONS = new Set([1, 7]);
/** Don't re-notify the same ticker+direction within this window. */
const DEDUP_WINDOW_DAYS = 3;

/** Does a freshly produced forecast qualify to surface as a signal?
 *
 * Gates on the model's INTRINSIC conviction (`rawConfidence`), not the
 * calibration-shrunk `confidence` shown on cards. The displayed confidence is
 * deliberately pulled toward the observed win rate (honest track record), but it
 * also feeds back into the calibration that produces the shrink — gating the
 * notification on it would couple the trigger to that recursive loop and could
 * silently switch notifications off right after a forecaster change. Conviction
 * (raw) is the stable trigger; the card still shows the honest number. Falls back
 * to `confidence` for predictions made before raw was recorded. */
export function qualifiesAsSignal(p: {
  direction: string;
  confidence: number;
  rawConfidence?: number;
  horizonDays: number;
  shadow?: boolean;
}): boolean {
  return (
    !p.shadow &&
    (p.direction === "UP" || p.direction === "DOWN") &&
    (p.rawConfidence ?? p.confidence) >= SIGNAL_CONFIDENCE_MIN &&
    SIGNAL_HORIZONS.has(p.horizonDays)
  );
}

/**
 * Notification language must match the calibrated (track-record-grounded)
 * confidence, not the model's stated conviction — "Strong signal … 18%
 * confidence" in one sentence erodes trust in every future signal.
 */
export function confidenceTier(calibrated: number): "speculative" | "moderate" | "strong" {
  if (calibrated < 0.35) return "speculative";
  if (calibrated < 0.55) return "moderate";
  return "strong";
}

/** Minimum resolved directional calls at a horizon before we cite precision. */
const PRECISION_SAMPLE_FLOOR = 10;
/** A new signal contradicting one emitted within this window gets flagged. */
const REVERSAL_WINDOW_DAYS = 7;

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : trimmed).trim();
}

/** Reduce candidates to the single highest-confidence one per ticker. */
function bestPerTicker(candidates: SignalCandidate[]): SignalCandidate[] {
  const byTicker = new Map<string, SignalCandidate>();
  for (const c of candidates) {
    const prev = byTicker.get(c.ticker);
    if (!prev || c.confidence > prev.confidence) byTicker.set(c.ticker, c);
  }
  return [...byTicker.values()];
}

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Find-or-create the user's dedicated "Agent Signals" conversation. */
async function getSignalsConversationId(sb: ServiceClient, userId: string): Promise<string | null> {
  const { data: pref } = await sb
    .from("user_preferences")
    .select("signals_conversation_id")
    .eq("user_id", userId)
    .maybeSingle();
  const existing = (pref as { signals_conversation_id?: string } | null)?.signals_conversation_id;
  if (existing) return existing;

  const { data: conv, error } = await sb
    .from("conversations")
    .insert({ user_id: userId, title: "Agent Signals" })
    .select("id")
    .single();
  if (error || !conv) {
    debug("agent", `[signals] failed to create signals conversation: ${error?.message}`);
    return null;
  }
  await sb.from("user_preferences").update({ signals_conversation_id: conv.id }).eq("user_id", userId);
  return conv.id;
}

/**
 * Emit user-facing notifications + chat messages for the strong signals from a
 * sweep. No-op for system runs (no real userId) or when there are no candidates.
 * Best-effort: never throws (callers wrap in non-fatal try/catch anyway).
 */
export async function emitSignals(
  userId: string | undefined,
  candidates: SignalCandidate[],
  store?: MetricsStore
): Promise<number> {
  if (!userId || candidates.length === 0) return 0;
  const picks = bestPerTicker(candidates);
  if (picks.length === 0) return 0;

  const sb = createServiceClient();
  const convId = await getSignalsConversationId(sb, userId);
  const now = Date.now();
  const sinceIso = new Date(now - DEDUP_WINDOW_DAYS * 86_400_000).toISOString();
  const reversalSinceIso = new Date(now - REVERSAL_WINDOW_DAYS * 86_400_000).toISOString();
  let emitted = 0;

  // Empirical directional precision per horizon — the honest track-record line
  // attached to each signal. One vault read per distinct horizon.
  const precisionLine = new Map<number, string>();
  if (store) {
    for (const h of new Set(picks.map((c) => c.horizonDays))) {
      try {
        const stats = await computeHorizonDirectionalStats(store, h);
        if (stats && stats.n >= PRECISION_SAMPLE_FLOOR) {
          precisionLine.set(
            h,
            `On resolved ${h}-day calls the model's directional precision is ${Math.round(stats.precision * 100)}% (n=${stats.n}). `
          );
        }
      } catch {
        // best-effort — a missing track-record line never blocks the signal
      }
    }
  }

  for (const c of picks) {
    const type = c.direction === "UP" ? "signal_positive" : "signal_negative";
    const oppositeType = c.direction === "UP" ? "signal_negative" : "signal_positive";

    // Dedup: skip if we already notified this ticker+direction recently.
    const { data: recent } = await sb
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("ticker", c.ticker)
      .eq("type", type)
      .gte("created_at", sinceIso)
      .limit(1);
    if (recent && recent.length > 0) continue;

    // Reversal check: an opposite-direction signal inside the window is not
    // suppressed (a reversal is information) but must be called out.
    const { data: opposite } = await sb
      .from("notifications")
      .select("created_at")
      .eq("user_id", userId)
      .eq("ticker", c.ticker)
      .eq("type", oppositeType)
      .gte("created_at", reversalSinceIso)
      .order("created_at", { ascending: false })
      .limit(1);
    const reversalOf = opposite?.[0]?.created_at as string | undefined;

    const label = (c.direction === "UP" ? VERDICT_LABEL.BUY : VERDICT_LABEL.SELL).toLowerCase();
    const tier = confidenceTier(c.confidence);
    const title = `${tier.charAt(0).toUpperCase()}${tier.slice(1)} ${label} signal · ${c.ticker}`;
    const lean = c.direction === "UP" ? "to the upside" : "to the downside";
    const oppositeLabel = (c.direction === "UP" ? VERDICT_LABEL.SELL : VERDICT_LABEL.BUY).toLowerCase();
    const reversalPrefix = reversalOf
      ? `⚠ Reversal: this contradicts the ${oppositeLabel} signal from ${reversalOf.slice(0, 10)} — treat the direction as contested. `
      : "";
    const conviction =
      typeof c.rawConfidence === "number" && Math.round(c.rawConfidence * 100) !== Math.round(c.confidence * 100)
        ? `model conviction ${Math.round(c.rawConfidence * 100)}%, calibrated to ~${Math.round(c.confidence * 100)}% by its track record`
        : `${Math.round(c.confidence * 100)}% confidence`;
    const body =
      reversalPrefix +
      `${c.ticker} is showing a ${tier} ${label} signal over the next ${c.horizonDays}-day horizon. ` +
      `The model leans ${lean} (~${c.magnitudePct.toFixed(1)}% projected move; ${conviction}). ` +
      `${firstSentence(c.reasoning)} ` +
      (precisionLine.get(c.horizonDays) ?? "") +
      `This is an informational sentiment signal, not investment advice.`;
    const link = convId ? `/agent?conv=${convId}` : "/agent";

    const { error: notifErr } = await sb.from("notifications").insert({
      user_id: userId,
      type,
      title,
      body,
      ticker: c.ticker,
      link,
    });
    if (notifErr) {
      debug("agent", `[signals] notification insert failed for ${c.ticker}: ${notifErr.message}`);
      continue;
    }

    if (convId) {
      await sb.from("messages").insert({
        conversation_id: convId,
        role: "assistant",
        content: `**${title}**\n\n${body}`,
      });
      await sb.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    }
    emitted++;
  }

  if (emitted > 0) debug("agent", `[signals] emitted ${emitted} signal notification(s) for user ${userId}`);
  return emitted;
}
