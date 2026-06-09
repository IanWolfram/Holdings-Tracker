/**
 * Standalone prediction resolution — resolves all eligible predictions without
 * requiring a full agent sweep. Can be called from an API route or scheduled cron.
 */
import { resolveEligiblePredictions } from "../world-brain/predictions";
import { updateCalibration } from "../world-brain/calibration";
import { getServices } from "../src/registry";
import { getBasicQuote } from "../lib/market-data";
import { getDailyBars } from "../lib/marketdata/prices";
import { WORLD_VAULT_PATH } from "../lib/constants";
import { FsVaultStore } from "../lib/vault/store";

export async function resolvePredictions(): Promise<{ resolved: number }> {
  if (!WORLD_VAULT_PATH) {
    console.warn("[resolve-predictions] No WORLD_VAULT_PATH configured.");
    return { resolved: 0 };
  }

  const store = new FsVaultStore(WORLD_VAULT_PATH);
  let totalResolved = 0;
  let positions: Array<{ ticker: string }>;

  try {
    const { portfolioService } = getServices();
    ({ positions } = await portfolioService.getPositionsSafe());
  } catch {
    console.warn("[resolve-predictions] Could not fetch positions — skipping.");
    return { resolved: 0 };
  }

  for (const pos of positions) {
    try {
      const quote = await getBasicQuote(pos.ticker);
      const bars = await getDailyBars(pos.ticker).catch(() => []);
      const result = await resolveEligiblePredictions(
        store,
        pos.ticker,
        quote?.currentPrice ?? null,
        Date.now(),
        undefined,
        bars
      );
      totalResolved += result.resolved;
    } catch {
      // non-fatal
    }
  }

  if (totalResolved > 0) {
    try {
      await updateCalibration(store);
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