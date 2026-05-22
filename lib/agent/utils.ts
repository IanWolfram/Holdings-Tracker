import { getServicesForUser } from "@/src/registry";
import type { MacroSnapshot } from "../marketdata/macro";
import type { CatalystType } from "@/types/predictions";

const DEV_USER_ID = "dev-user-id";

export { DEV_USER_ID };

/**
 * Fetch positions for the given user (or fall back to dev/single-user mode).
 * Routes through PortfolioService so per-user Supabase tokens are honored.
 */
export async function fetchUserPositions(userId?: string) {
  const { portfolioService } = await getServicesForUser(userId ?? DEV_USER_ID);
  const { positions } = await portfolioService.getPositionsSafe();
  return positions;
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