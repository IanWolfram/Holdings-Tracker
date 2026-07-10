/**
 * Manually resolve every user's eligible pending predictions (the same pass the
 * daily 22:00 UTC cron runs) — for clearing backlog after downtime or verifying
 * the resolver end-to-end.
 *
 * Usage:
 *   npm run resolve:all                          → all users
 *   npm run resolve:all -- --user <uuid>         → one user
 *   npm run resolve:all -- --recalibrate         → also rebuild calibration.json
 *                                                  for each user even when
 *                                                  nothing new resolved (heals a
 *                                                  stale/mis-bucketed report)
 */
import { hydrateSecrets } from "../lib/secrets";
import { createServiceClient } from "../lib/supabase/server";
import { getVaultStore } from "../lib/vault/store";
import { resolvePendingForUser } from "../world-brain/resolve-all";
import { updateCalibration } from "../world-brain/calibration";

async function main() {
  await hydrateSecrets();

  const args = process.argv.slice(2);
  const recalibrate = args.includes("--recalibrate");
  const userFlag = args.indexOf("--user");
  const onlyUser = userFlag >= 0 ? args[userFlag + 1] : null;

  let userIds: string[];
  if (onlyUser) {
    userIds = [onlyUser];
  } else {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("vault_notes")
      .select("user_id")
      .like("path", "predictions/%");
    if (error || !data) {
      console.error("Failed to list prediction owners:", error?.message);
      process.exit(1);
    }
    userIds = [...new Set(data.map((row) => row.user_id as string))];
  }

  console.info(`Resolving pending predictions for ${userIds.length} user(s)…`);
  let totalResolved = 0;
  let totalExpired = 0;

  for (const userId of userIds) {
    try {
      const { resolved, expired, tickers } = await resolvePendingForUser(userId);
      totalResolved += resolved;
      totalExpired += expired;
      console.info(`  ${userId}: resolved ${resolved}, expired ${expired} (${tickers} ticker file(s))`);

      if (recalibrate) {
        const store = await getVaultStore(userId);
        const report = await updateCalibration(store);
        console.info(`  ${userId}: calibration.json rebuilt — ${report.totalResolved} resolved predictions`);
      }
    } catch (err) {
      console.error(`  ${userId}: FAILED —`, (err as Error).message);
    }
  }

  console.info(`Done. Resolved ${totalResolved}, expired ${totalExpired} across ${userIds.length} user(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
