/**
 * Stock-watch evaluator: the missing runtime behind the price-alert / verdict
 * rules stored in `stock_watches`. A cron tick (instrumentation.node.ts) calls
 * evaluateWatches(); it checks each enabled rule against live data and, on a
 * fresh trigger, writes a per-user notification.
 *
 * Edge-triggered, not level-triggered: `last_seen_value` holds the previous
 * observation so a price that merely stays above its threshold doesn't re-fire
 * every tick — only the crossing does. `cooldown_minutes` is a second guard.
 *
 * Multi-tenant: rules and notifications are always user-scoped. Quotes are
 * ticker-keyed (portfolio-agnostic) so they're fetched once per symbol and
 * shared across users watching the same ticker.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { getBasicQuote } from "@/lib/market-data";
import { getServicesForUser } from "@/src/registry";
import type { WatchRule } from "./scheduler";
import { debug } from "../debug";

interface WatchRow {
  id: string;
  user_id: string;
  symbol: string;
  rule: WatchRule;
  enabled: boolean;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  last_seen_value: unknown;
}

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Net verdict for a ticker from the user's classified news feed. */
async function netVerdict(userId: string, symbol: string): Promise<"BUY" | "SELL" | "HOLD"> {
  const { newsService } = await getServicesForUser(userId);
  const stories = await newsService.getNewsForTicker(symbol);
  let score = 0;
  for (const s of stories) {
    if (s.verdict === "BUY") score += 1;
    else if (s.verdict === "SELL") score -= 1;
  }
  if (score > 0) return "BUY";
  if (score < 0) return "SELL";
  return "HOLD";
}

/** Human-readable trigger message for a fired rule, or null if not triggered. */
function priceTrigger(
  rule: Extract<WatchRule, { type: "price_above" | "price_below" }>,
  symbol: string,
  current: number,
  previous: number | null,
): { title: string; body: string } | null {
  const crossedUp =
    rule.type === "price_above" && current >= rule.value && (previous == null || previous < rule.value);
  const crossedDown =
    rule.type === "price_below" && current <= rule.value && (previous == null || previous > rule.value);
  if (!crossedUp && !crossedDown) return null;

  const dir = rule.type === "price_above" ? "above" : "below";
  return {
    title: `${symbol} crossed ${dir} $${rule.value}`,
    body: `${symbol} is now at $${current.toFixed(2)}, ${dir} your $${rule.value} alert. This is an informational price alert, not investment advice.`,
  };
}

async function fire(
  sb: ServiceClient,
  watch: WatchRow,
  trigger: { title: string; body: string },
  seenValue: unknown,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await sb.from("notifications").insert({
    user_id: watch.user_id,
    type: "watch_alert",
    title: trigger.title,
    body: trigger.body,
    ticker: watch.symbol,
    link: "/terminal",
  });
  if (error) {
    debug("agent", `[watches] notification insert failed for ${watch.symbol}: ${error.message}`);
    return;
  }
  await sb
    .from("stock_watches")
    .update({ last_triggered_at: nowIso, last_seen_value: seenValue, updated_at: nowIso })
    .eq("id", watch.id);
}

function withinCooldown(watch: WatchRow): boolean {
  if (!watch.last_triggered_at) return false;
  const elapsedMs = Date.now() - new Date(watch.last_triggered_at).getTime();
  return elapsedMs < watch.cooldown_minutes * 60_000;
}

/**
 * Evaluate every enabled watch once. Best-effort and non-throwing: a single
 * bad watch is logged and skipped, never blocking the rest. Returns the number
 * of alerts fired this run.
 */
export async function evaluateWatches(): Promise<number> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("stock_watches")
    .select("id, user_id, symbol, rule, enabled, cooldown_minutes, last_triggered_at, last_seen_value")
    .eq("enabled", true);
  if (error) {
    console.error("[watches] failed to load watches:", error.message);
    return 0;
  }
  const watches = (data ?? []) as WatchRow[];
  if (watches.length === 0) return 0;

  // One quote per distinct symbol that any price rule needs.
  const priceSymbols = new Set(
    watches.filter((w) => w.rule.type !== "verdict_flip").map((w) => w.symbol),
  );
  const quotes = new Map<string, number | null>();
  await Promise.all(
    [...priceSymbols].map(async (sym) => {
      try {
        const q = await getBasicQuote(sym);
        quotes.set(sym, q?.currentPrice ?? null);
      } catch {
        quotes.set(sym, null);
      }
    }),
  );

  let fired = 0;
  for (const watch of watches) {
    try {
      if (watch.rule.type === "verdict_flip") {
        const current = await netVerdict(watch.user_id, watch.symbol);
        const previous = typeof watch.last_seen_value === "string" ? watch.last_seen_value : null;
        const flipped = previous != null && previous !== current;
        // Always advance last_seen_value so the next flip is edge-detected.
        if (flipped && !withinCooldown(watch)) {
          await fire(
            sb,
            watch,
            {
              title: `${watch.symbol} sentiment flipped to ${current}`,
              body: `${watch.symbol}'s net news sentiment changed from ${previous} to ${current}. This is an informational sentiment signal, not investment advice.`,
            },
            current,
          );
          fired++;
        } else if (previous !== current) {
          await sb.from("stock_watches").update({ last_seen_value: current }).eq("id", watch.id);
        }
        continue;
      }

      // Price rules
      const current = quotes.get(watch.symbol);
      if (current == null) continue;
      const previous = typeof watch.last_seen_value === "number" ? watch.last_seen_value : null;
      const trigger = priceTrigger(watch.rule, watch.symbol, current, previous);
      if (trigger && !withinCooldown(watch)) {
        await fire(sb, watch, trigger, current);
        fired++;
      } else if (previous !== current) {
        // Track the latest price even when not firing, so crossings are detected.
        await sb.from("stock_watches").update({ last_seen_value: current }).eq("id", watch.id);
      }
    } catch (err) {
      console.error(`[watches] eval failed for ${watch.symbol}:`, (err as Error).message);
    }
  }

  if (fired > 0) debug("agent", `[watches] fired ${fired} alert(s)`);
  return fired;
}
