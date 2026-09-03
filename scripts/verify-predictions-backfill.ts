/**
 * Independent verification that the predictions table faithfully mirrors the
 * legacy JSON blobs — the gate before anyone deletes the source vault files.
 *
 * Deliberately does NOT use the migration code under test on the table side: it
 * reads the table with raw selects and re-parses the JSON separately, then
 * diffs per-user counts, a per-row fingerprint, and calibration aggregates
 * (resolved-non-shadow n + win rate). Read-only; exits non-zero on any mismatch.
 *
 *   npx tsx --env-file=.env.local scripts/verify-predictions-backfill.ts
 */
import { createServiceClient } from "../lib/supabase/server";
import { parsePredictions } from "../types/predictions";
import type { TickerPrediction } from "../types/predictions";

const PAGE = 1000;

/** Canonical, float-tolerant fingerprint of a prediction's load-bearing fields. */
function fingerprint(p: {
  id: string; status: string; direction: string; outcome?: string | null;
  horizonDays: number; shadow?: boolean; magnitudePct: number;
  actualPct?: number | null; priceAtPrediction: number;
}): string {
  const r = (n: number | null | undefined) =>
    n === null || n === undefined ? "-" : Math.round(n * 100) / 100;
  return [
    p.id, p.status, p.direction, p.outcome ?? "-", p.horizonDays,
    p.shadow ? "1" : "0", r(p.magnitudePct), r(p.actualPct), r(p.priceAtPrediction),
  ].join("|");
}

/** resolved + non-shadow, with the confidence/outcome guards calibration uses. */
function calibrationAgg(preds: TickerPrediction[]) {
  const resolved = preds.filter(
    (p) => p.status === "resolved" && !p.shadow && typeof p.confidence === "number" && !!p.outcome,
  );
  const correct = resolved.filter((p) => p.outcome === "CORRECT").length;
  return { n: resolved.length, correct, winRate: resolved.length ? correct / resolved.length : 0 };
}

async function main() {
  const sb = createServiceClient();

  // ── JSON side ──
  const files: { user_id: string; path: string; body: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("vault_notes").select("user_id, path, body")
      .like("path", "predictions/%")
      .order("user_id").order("path").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    files.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const jsonByUser = new Map<string, TickerPrediction[]>();
  for (const f of files) {
    let raw: unknown;
    try { raw = JSON.parse(f.body); } catch { continue; }
    const { predictions } = parsePredictions(raw);
    const bucket = jsonByUser.get(f.user_id) ?? [];
    bucket.push(...predictions);
    jsonByUser.set(f.user_id, bucket);
  }

  // ── Table side (raw select, independent of the migration code) ──
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("predictions").select("*")
      .order("user_id").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  const tableByUser = new Map<string, TickerPrediction[]>();
  for (const row of rows as Record<string, unknown>[]) {
    const p = {
      id: row.id as string, ticker: row.ticker as string, status: row.status as string,
      direction: row.direction as string, outcome: (row.outcome as string) ?? null,
      horizonDays: row.horizon_days as number, shadow: (row.shadow as boolean) ?? false,
      confidence: row.confidence as number, magnitudePct: row.magnitude_pct as number,
      actualPct: (row.actual_pct as number) ?? null, priceAtPrediction: row.price_at_prediction as number,
    } as unknown as TickerPrediction;
    const uid = row.user_id as string;
    const bucket = tableByUser.get(uid) ?? [];
    bucket.push(p);
    tableByUser.set(uid, bucket);
  }

  // ── Diff ──
  const users = new Set([...jsonByUser.keys(), ...tableByUser.keys()]);
  let ok = true;
  for (const uid of users) {
    const j = jsonByUser.get(uid) ?? [];
    const t = tableByUser.get(uid) ?? [];
    const jFp = new Set(j.map(fingerprint));
    const tFp = new Set(t.map(fingerprint));
    const missingInTable = [...jFp].filter((x) => !tFp.has(x));
    const extraInTable = [...tFp].filter((x) => !jFp.has(x));
    const ja = calibrationAgg(j);
    const ta = calibrationAgg(t);

    const countOk = j.length === t.length;
    const fpOk = missingInTable.length === 0 && extraInTable.length === 0;
    const aggOk = ja.n === ta.n && ja.correct === ta.correct;
    const userOk = countOk && fpOk && aggOk;
    ok = ok && userOk;

    console.log(`user ${uid}: ${userOk ? "OK" : "MISMATCH"}`);
    console.log(`  count   json=${j.length} table=${t.length} ${countOk ? "✓" : "✗"}`);
    console.log(`  rows    missingInTable=${missingInTable.length} extraInTable=${extraInTable.length} ${fpOk ? "✓" : "✗"}`);
    console.log(`  calib   json(n=${ja.n},correct=${ja.correct},wr=${ja.winRate.toFixed(4)}) table(n=${ta.n},correct=${ta.correct},wr=${ta.winRate.toFixed(4)}) ${aggOk ? "✓" : "✗"}`);
    if (missingInTable.length) console.log("    missing:", missingInTable.slice(0, 5));
    if (extraInTable.length) console.log("    extra:", extraInTable.slice(0, 5));
  }

  console.log(ok ? "PASS — table matches JSON exactly" : "FAIL — mismatch found");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("[verify] fatal:", err);
  process.exit(1);
});
