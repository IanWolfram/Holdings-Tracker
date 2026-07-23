import { getServicesForUser } from "@/src/registry";
import { createServiceClient } from "@/lib/supabase/server";
import type { Position } from "@/types/position.types";
import type { MacroSnapshot } from "../marketdata/macro";
import type { CatalystType } from "@/types/predictions";

const DEV_USER_ID = "dev-user-id";

export { DEV_USER_ID };

/**
 * Load the user's proposed (watchlist) positions as zero-quantity Position rows
 * so the agent sweep analyzes and forecasts them alongside real holdings.
 * Best-effort: any failure returns [] and never blocks the sweep.
 */
async function fetchProposedPositions(userId: string): Promise<Position[]> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("proposed_positions")
      .select("ticker, target_shares, target_price, added_at")
      .eq("user_id", userId)
      .order("added_at", { ascending: true });
    if (error || !data) return [];
    return data.map((row) => ({
      ticker: (row.ticker as string).toUpperCase(),
      description: "Proposed position",
      quantity: 0,
      marketValue: 0,
      gainLoss: 0,
      pricePaid: 0,
      currentPrice: 0,
      isProposed: true,
      targetShares: (row.target_shares as number | null) ?? undefined,
      targetPrice: (row.target_price as number | null) ?? undefined,
      addedAt: row.added_at ? new Date(row.added_at as string).getTime() : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch positions for the given user (or fall back to dev/single-user mode).
 * Routes through PortfolioService so per-user Supabase tokens are honored.
 * Held positions come first, then proposed (watchlist) tickers not already
 * held — ordering matters because the sweep cap keeps the head of the list.
 */
export async function fetchUserPositions(userId?: string) {
  const { portfolioService } = await getServicesForUser(userId ?? DEV_USER_ID);
  const { positions } = await portfolioService.getPositionsSafe();
  if (!userId) return positions;
  const proposed = await fetchProposedPositions(userId);
  if (proposed.length === 0) return positions;
  const held = new Set(positions.map((p) => p.ticker.toUpperCase()));
  return [...positions, ...proposed.filter((p) => !held.has(p.ticker))];
}

export function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
}

export function summarizeMacroForPrompt(snapshot?: MacroSnapshot | null): string {
  if (!snapshot) return "";
  return [
    "\n\nMarket State:",
    `VIX: ${formatNumber(snapshot.vix)} | 10Y: ${formatNumber(snapshot.tenY)}% | DXY: ${formatNumber(snapshot.dxy)} | Regime: ${snapshot.regime}`,
    snapshot.summary,
  ].join("\n");
}

export function uniqueCatalystTypes(types: CatalystType[]): CatalystType[] {
  return [...new Set(types)];
}