/**
 * Phase 5 — Continuous Self-Tuning
 *
 * Reads `_metrics/calibration.json` and updates a managed Calibration
 * Provenance section in `world-brain/sector-rules.md`. The provenance section
 * is delimited by `<!-- BEGIN AUTO -->` / `<!-- END AUTO -->` markers so the
 * hand-written rules stay untouched while the auto data is replaced wholesale
 * on each run.
 *
 * Usage:
 *   npm run recalibrate              → dry run, prints diff
 *   npm run recalibrate -- --apply   → write changes to sector-rules.md
 */
import fs from "fs";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { resolveVaultPath } from "../lib/constants";
import { loadCalibrationReport, type CalibrationStats } from "../world-brain/calibration";
import { CATALYST_TYPES, type CatalystType } from "../types/predictions";

interface CatalystExpectation {
  catalyst: CatalystType;
  ruleHint: string;
  expectedConfidenceMid: number; // What sector-rules.md implies the model should output.
}

// Mapping derived from the BUY/SELL signals sections of sector-rules.md.
// The midpoint represents the rule-implied confidence the model produces for
// this catalyst — divergence between this and actual win rate is the signal
// the recalibration loop is built around.
const CATALYST_EXPECTATIONS: CatalystExpectation[] = [
  { catalyst: "govt-contract", ruleHint: "Government contract win — 0.85+", expectedConfidenceMid: 0.88 },
  { catalyst: "earnings-beat", ruleHint: "Earnings beat + guidance raise — 0.90+", expectedConfidenceMid: 0.92 },
  { catalyst: "earnings-miss", ruleHint: "Guidance cut — high-confidence SELL", expectedConfidenceMid: 0.85 },
  { catalyst: "analyst-upgrade", ruleHint: "Analyst upgrade w/ price target — 0.75-0.89", expectedConfidenceMid: 0.82 },
  { catalyst: "analyst-downgrade", ruleHint: "Analyst downgrade — moderate SELL", expectedConfidenceMid: 0.7 },
  { catalyst: "regulatory", ruleHint: "Regulatory — varies by direction", expectedConfidenceMid: 0.75 },
  { catalyst: "m-and-a", ruleHint: "M&A — tier-1 BUY signal", expectedConfidenceMid: 0.8 },
  { catalyst: "macro", ruleHint: "Macro context — sentiment driven", expectedConfidenceMid: 0.65 },
  { catalyst: "technical", ruleHint: "Technical only — sentiment driven", expectedConfidenceMid: 0.6 },
  { catalyst: "leadership", ruleHint: "Executive change — moderate", expectedConfidenceMid: 0.7 },
  { catalyst: "product-launch", ruleHint: "Product launch — moderate BUY", expectedConfidenceMid: 0.7 },
  { catalyst: "partnership", ruleHint: "Strategic partnership — strong BUY", expectedConfidenceMid: 0.8 },
];

const DRIFT_THRESHOLD = 0.15; // 15 pp mismatch between expected and actual.
const BEGIN_MARKER = "<!-- BEGIN AUTO: Calibration Provenance -->";
const END_MARKER = "<!-- END AUTO: Calibration Provenance -->";

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key || key in process.env) continue;
    process.env[key] = rest.join("=").trim();
  }
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatDriftLine(
  expectation: CatalystExpectation,
  stats: CalibrationStats,
  todayKey: string
): { line: string; drift: number } {
  const drift = stats.winRate - expectation.expectedConfidenceMid;
  const flag =
    Math.abs(drift) >= DRIFT_THRESHOLD
      ? drift < 0
        ? " (DOWNWEIGHT)"
        : " (TRUSTED)"
      : "";
  const sign = drift >= 0 ? "+" : "";
  const line = `- **${expectation.catalyst}** — n=${stats.n}, winRate ${pct(stats.winRate)} vs rule-implied ${pct(expectation.expectedConfidenceMid)} (drift ${sign}${(drift * 100).toFixed(1)}pp)${flag}. ${expectation.ruleHint}. _last updated: ${todayKey}_`;
  return { line, drift };
}

function buildEngineLeaderboard(
  byEngine: Record<string, CalibrationStats> | undefined
): string[] {
  const entries = Object.entries(byEngine ?? {})
    .filter(([, stats]) => stats.n >= 3)
    .sort((a, b) => b[1].winRate - a[1].winRate);
  if (entries.length === 0) {
    return ["- _Insufficient per-engine data (need ≥3 resolved predictions per engine)._"];
  }
  return entries.map(
    ([engine, stats]) =>
      `- \`${engine}\` — ${pct(stats.winRate)} (n=${stats.n}, avg conf ${stats.avgConfidence.toFixed(2)})`
  );
}

interface RecalibrateProposal {
  body: string;
  catalystsWithDrift: number;
  catalystsTotal: number;
}

function buildProposal(vaultPath: string): RecalibrateProposal | null {
  const report = loadCalibrationReport(vaultPath);
  if (!report) return null;

  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(BEGIN_MARKER);
  lines.push("");
  lines.push("## Calibration Provenance (auto-generated)");
  lines.push("");
  lines.push(
    `_Generated by \`scripts/recalibrate.ts\` on ${today}. ${report.totalResolved} resolved predictions across ${Object.keys(report.byTicker).length} tickers. Edit by re-running \`npm run recalibrate -- --apply\`._`
  );
  lines.push("");

  // Per-catalyst calibration vs rule expectations.
  lines.push("### Catalyst calibration");
  lines.push("");
  let driftCount = 0;
  let totalCount = 0;
  for (const expectation of CATALYST_EXPECTATIONS) {
    const stats = report.byCatalyst[expectation.catalyst];
    if (!stats || stats.n < 3) {
      lines.push(
        `- **${expectation.catalyst}** — insufficient data (n=${stats?.n ?? 0}). ${expectation.ruleHint}.`
      );
      continue;
    }
    const { line, drift } = formatDriftLine(expectation, stats, today);
    lines.push(line);
    totalCount += 1;
    if (Math.abs(drift) >= DRIFT_THRESHOLD) driftCount += 1;
  }

  // Catalysts present in calibration but missing from the expectations table.
  const knownTypes = new Set<string>(CATALYST_EXPECTATIONS.map((e) => e.catalyst));
  const orphans = Object.entries(report.byCatalyst)
    .filter(([type, stats]) => !knownTypes.has(type) && stats.n >= 3 && type !== "other")
    .sort((a, b) => b[1].n - a[1].n);
  if (orphans.length > 0) {
    lines.push("");
    lines.push("### Untracked catalyst types (consider adding to rules)");
    lines.push("");
    for (const [type, stats] of orphans) {
      lines.push(
        `- **${type}** — n=${stats.n}, winRate ${pct(stats.winRate)}, avg conf ${stats.avgConfidence.toFixed(2)}.`
      );
    }
  }

  // Per-engine leaderboard for multi-engine A/B routing decisions.
  lines.push("");
  lines.push("### Engine leaderboard");
  lines.push("");
  lines.push(...buildEngineLeaderboard(report.byEngine));

  // Confidence-bucket calibration for over/under-confidence patterns.
  lines.push("");
  lines.push("### Confidence-bucket calibration");
  lines.push("");
  const buckets = Object.entries(report.byConfidenceBucket)
    .filter(([, stats]) => stats.n >= 3)
    .sort((a, b) => a[0].localeCompare(b[0]));
  if (buckets.length === 0) {
    lines.push("- _Insufficient bucketed data._");
  } else {
    for (const [bucket, stats] of buckets) {
      const [lo, hi] = bucket.split("-").map(parseFloat);
      const mid = (lo + hi) / 2;
      const drift = stats.winRate - mid;
      const sign = drift >= 0 ? "+" : "";
      lines.push(
        `- ${bucket}: actual ${pct(stats.winRate)} vs implied ${pct(mid)} (drift ${sign}${(drift * 100).toFixed(1)}pp, n=${stats.n})`
      );
    }
  }

  lines.push("");
  lines.push(END_MARKER);

  return {
    body: lines.join("\n"),
    catalystsWithDrift: driftCount,
    catalystsTotal: totalCount,
  };
}

function applyProposal(rulesPath: string, proposal: RecalibrateProposal): "updated" | "appended" {
  const existing = fs.readFileSync(rulesPath, "utf-8");
  const beginIdx = existing.indexOf(BEGIN_MARKER);
  const endIdx = existing.indexOf(END_MARKER);

  let next: string;
  let mode: "updated" | "appended";
  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    const before = existing.slice(0, beginIdx).replace(/\s+$/, "");
    const after = existing.slice(endIdx + END_MARKER.length).replace(/^\s+/, "");
    next = `${before}\n\n${proposal.body}\n\n${after}\n`;
    mode = "updated";
  } else {
    const trimmed = existing.replace(/\s+$/, "");
    next = `${trimmed}\n\n${proposal.body}\n`;
    mode = "appended";
  }

  if (next === existing) return mode;
  const tmp = `${rulesPath}.tmp`;
  fs.writeFileSync(tmp, next, "utf-8");
  fs.renameSync(tmp, rulesPath);
  return mode;
}

async function main(): Promise<void> {
  loadLocalEnv();

  const apply = process.argv.includes("--apply");
  const vaultPathRaw = process.env.WORLD_VAULT_PATH ?? "./world-vault";
  const vaultPath = resolveVaultPath(vaultPathRaw) ?? vaultPathRaw;

  const calibrationFile = path.join(vaultPath, "_metrics", "calibration.json");
  if (!fs.existsSync(calibrationFile)) {
    console.error(`[recalibrate] calibration.json not found at ${calibrationFile}.`);
    console.error(`[recalibrate] Run \`npm run backfill -- --apply\` or a live agent run first.`);
    process.exit(1);
  }

  const proposal = buildProposal(vaultPath);
  if (!proposal) {
    console.error("[recalibrate] Failed to load calibration report.");
    process.exit(1);
  }

  const rulesPath = path.join(process.cwd(), "world-brain", "sector-rules.md");
  if (!fs.existsSync(rulesPath)) {
    console.error(`[recalibrate] sector-rules.md not found at ${rulesPath}.`);
    process.exit(1);
  }

  if (apply) {
    const mode = applyProposal(rulesPath, proposal);
    console.log(
      `[recalibrate] sector-rules.md ${mode}: ${proposal.catalystsWithDrift}/${proposal.catalystsTotal} catalysts beyond ${(DRIFT_THRESHOLD * 100).toFixed(0)}pp drift.`
    );
    return;
  }

  console.log("[recalibrate] DRY RUN — proposed Calibration Provenance section:\n");
  console.log(proposal.body);
  console.log(
    `\n[recalibrate] ${proposal.catalystsWithDrift}/${proposal.catalystsTotal} catalysts beyond ${(DRIFT_THRESHOLD * 100).toFixed(0)}pp drift.`
  );
  console.log("[recalibrate] Run with --apply to update sector-rules.md.");
}

main().catch((err) => {
  console.error("[recalibrate] Fatal error:", err);
  process.exit(1);
});

// Suppress the "value is never read" lint hint when CATALYST_TYPES is imported
// for type-narrowing only.
void CATALYST_TYPES;
