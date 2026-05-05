/**
 * Standalone prediction resolution — resolves all eligible predictions without
 * requiring a full agent sweep. Can be called from an API route or scheduled cron.
 */
import { resolveEligiblePredictions } from "../world-brain/predictions";
import { updateCalibration } from "../world-brain/calibration";
import { getPositions } from "../lib/etrade";
import { getQuote } from "../lib/market-data";
import { WORLD_VAULT_PATH } from "../lib/constants";

export async function resolvePredictions(): Promise<{ resolved: number }> {
  if (!WORLD_VAULT_PATH) {
    console.warn("[resolve-predictions] No WORLD_VAULT_PATH configured.");
    return { resolved: 0 };
  }

  let totalResolved = 0;
  let positions: Array<{ ticker: string }>;

  try {
    positions = await getPositions();
  } catch {
    console.warn("[resolve-predictions] Could not fetch positions — skipping.");
    return { resolved: 0 };
  }

  for (const pos of positions) {
    try {
      const quote = await getQuote(pos.ticker);
      const result = resolveEligiblePredictions(
        WORLD_VAULT_PATH,
        pos.ticker,
        quote?.currentPrice ?? null,
        Date.now()
      );
      totalResolved += result.resolved;
    } catch {
      // non-fatal
    }
  }

  if (totalResolved > 0) {
    try {
      updateCalibration(WORLD_VAULT_PATH);
    } catch (err) {
      console.error("[resolve-predictions] Calibration update failed (non-fatal):", err);
    }
  }

  console.log(`[resolve-predictions] Resolved ${totalResolved} predictions.`);
  return { resolved: totalResolved };
}

// Run standalone
resolvePredictions().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});