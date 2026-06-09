import fs from "fs";
import path from "path";
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { PredictionDirection, TickerPrediction } from "../types/predictions";
import { resolveVaultPath } from "../lib/constants";
import { getDailyBars, type DailyBar } from "../lib/marketdata/prices";
import {
  findBarOnOrBefore,
  findBarOnOrAfter,
  flatBandFromBars,
} from "../lib/marketdata/volatility";
import {
  computePredictionOutcome,
  loadPredictions,
  savePredictions,
} from "../world-brain/predictions";
import { updateCalibration } from "../world-brain/calibration";
import { FsVaultStore } from "../lib/vault/store";
import { classifyCatalystTypes } from "../world-brain/catalyst-classifier";

interface BackfillStats {
  scanned: number;
  eligible: number;
  created: number;
  skippedExisting: number;
  skippedNoTicker: number;
  skippedNoPrice: number;
  skippedInvalid: number;
}

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

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const output: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const rawValue = line.slice(idx + 1).trim();
    output[key] = rawValue.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  }
  return output;
}

function readHeadline(content: string, fallback: string): string {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fallback;
}

function readReason(content: string): string {
  const reason = content.match(/## AI Analysis\n([\s\S]*?)(?:\n##|$)/)?.[1]?.trim() ?? "";
  if (reason === "_No analysis available._") return "";
  return reason;
}

function verdictToDirection(verdict: string): PredictionDirection | null {
  const normalized = verdict.toUpperCase();
  if (normalized === "BUY") return "UP";
  if (normalized === "SELL") return "DOWN";
  if (normalized === "HOLD") return "FLAT";
  return null;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function magnitudeFromConfidence(direction: PredictionDirection, confidence: number): number {
  if (direction === "FLAT") return 0;
  const scaled = 1 + confidence * 7;
  return Math.round(Math.max(1, Math.min(12, scaled)) * 10) / 10;
}

function toDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function createPredictionId(ticker: string, date: string, source: string): string {
  const digest = crypto.createHash("sha1").update(`${ticker}|${date}|${source}`).digest("hex").slice(0, 12);
  return `backfill-${ticker}-${date}-${digest}`;
}

async function main(): Promise<void> {
  loadLocalEnv();

  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run") || !apply;
  const vaultPathRaw = process.env.WORLD_VAULT_PATH ?? "./world-vault";
  const vaultPath = resolveVaultPath(vaultPathRaw) ?? vaultPathRaw;
  const store = new FsVaultStore(vaultPathRaw);
  const newsDir = path.join(vaultPath, "news");

  if (!fs.existsSync(newsDir)) {
    throw new Error(`News directory not found: ${newsDir}`);
  }

  const files = fs
    .readdirSync(newsDir)
    .filter((name) => name.endsWith(".md"))
    .sort();

  const stats: BackfillStats = {
    scanned: 0,
    eligible: 0,
    created: 0,
    skippedExisting: 0,
    skippedNoTicker: 0,
    skippedNoPrice: 0,
    skippedInvalid: 0,
  };

  const pendingByTickerDate = new Map<string, TickerPrediction>();
  const existingByTicker = new Map<string, TickerPrediction[]>();
  const barCache = new Map<string, DailyBar[]>();

  for (const file of files) {
    stats.scanned += 1;

    const fullPath = path.join(newsDir, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const fm = parseFrontmatter(content);

    const ticker = fm.ticker?.toUpperCase();
    const date = fm.date;
    const verdict = fm.verdict;
    if (!ticker || !date || !verdict) {
      stats.skippedNoTicker += 1;
      continue;
    }

    const direction = verdictToDirection(verdict);
    if (!direction) {
      stats.skippedInvalid += 1;
      continue;
    }

    const groupKey = `${ticker}|${date}`;
    const headline = readHeadline(content, file);
    const reason = readReason(content);
    const confidence = clampConfidence(parseFloat(fm.confidence ?? "0.5"));
    const catalystTypes = classifyCatalystTypes({
      headline,
      reason,
      verdict,
    });

    const newCatalyst = {
      headline: headline.slice(0, 120),
      verdict,
      confidence,
      catalystTypes,
    };

    if (pendingByTickerDate.has(groupKey)) {
      const existing = pendingByTickerDate.get(groupKey)!;
      // If directions conflict, we stick with the first one for now or we could implement better logic.
      // Usually they are consistent in backfills.
      if (!existing.catalysts.some(c => c.headline === newCatalyst.headline)) {
        existing.catalysts.push(newCatalyst);
        existing.catalystTypes = [...new Set([...(existing.catalystTypes || []), ...catalystTypes])];
      }
      continue;
    }

    const runAt = Date.parse(`${date}T16:00:00.000Z`);
    if (!Number.isFinite(runAt)) {
      stats.skippedInvalid += 1;
      continue;
    }

    const resolutionTargetMs = runAt + 7 * 86_400_000;
    const resolutionTargetDate = toDateKey(resolutionTargetMs);

    let bars = barCache.get(ticker);
    if (!bars) {
      bars = await getDailyBars(ticker, 730).catch(() => []);
      barCache.set(ticker, bars);
    }
    if (!bars || bars.length < 20) {
      stats.skippedNoPrice += 1;
      continue;
    }

    const predictionBar = findBarOnOrBefore(bars, date);
    const resolutionBar = findBarOnOrAfter(bars, resolutionTargetDate);
    if (!predictionBar || !resolutionBar) {
      stats.skippedNoPrice += 1;
      continue;
    }

    const magnitudePct = magnitudeFromConfidence(direction, confidence);
    const actualPct =
      ((resolutionBar.close - predictionBar.close) / predictionBar.close) * 100;
    const roundedActualPct = Math.round(actualPct * 100) / 100;
    const band = flatBandFromBars(bars, date, 7);
    const outcome = computePredictionOutcome(direction, magnitudePct, roundedActualPct, band);

    const sourceUrl = fm.url ?? fullPath;
    const id = createPredictionId(ticker, date, sourceUrl);
    let existing = existingByTicker.get(ticker);
    if (!existing) {
      existing = await loadPredictions(store, ticker);
      existingByTicker.set(ticker, existing);
    }

    if (existing.some((p) => p.runAt === runAt && p.direction === direction)) {
      stats.skippedExisting += 1;
      continue;
    }

    stats.eligible += 1;
    const synthetic: TickerPrediction = {
      id,
      ticker,
      runAt,
      priceAtPrediction: predictionBar.close,
      direction,
      magnitudePct,
      horizonDays: 7,
      confidence,
      reasoning: reason || "Backfilled from historical vault note.",
      catalysts: [newCatalyst],
      catalystTypes,
      engine: "backfill-v1",
      status: "resolved",
      sourceUrl,
      synthetic: true,
      resolvedAt: Date.parse(`${resolutionBar.date}T16:00:00.000Z`),
      priceAtResolution: resolutionBar.close,
      actualPct: roundedActualPct,
      outcome,
      flatBandPct: Math.round(band * 100) / 100,
    };

    pendingByTickerDate.set(groupKey, synthetic);
    stats.created += 1;
  }

  const pendingByTicker = new Map<string, TickerPrediction[]>();
  for (const prediction of pendingByTickerDate.values()) {
    const list = pendingByTicker.get(prediction.ticker) ?? [];
    list.push(prediction);
    pendingByTicker.set(prediction.ticker, list);
  }

  if (apply) {
    for (const [ticker, additions] of pendingByTicker.entries()) {
      const existing = existingByTicker.get(ticker) ?? await loadPredictions(store, ticker);
      const merged = [...existing, ...additions].sort((a, b) => a.runAt - b.runAt);
      await savePredictions(store, ticker, merged);
    }

    const calibration = await updateCalibration(new FsVaultStore(vaultPath));
    console.log("[backfill] Applied backfill and regenerated calibration metrics.");
    console.log(`[backfill] Total resolved predictions: ${calibration.totalResolved}`);
  }

  const modeLabel = dryRun ? "DRY RUN" : "APPLY";
  console.log(`[backfill] Mode: ${modeLabel}`);
  console.log(`[backfill] Scanned notes: ${stats.scanned}`);
  console.log(`[backfill] Eligible notes: ${stats.eligible}`);
  console.log(`[backfill] Created synthetic predictions: ${stats.created}`);
  console.log(`[backfill] Skipped existing: ${stats.skippedExisting}`);
  console.log(`[backfill] Skipped missing ticker/date/verdict: ${stats.skippedNoTicker}`);
  console.log(`[backfill] Skipped missing price history: ${stats.skippedNoPrice}`);
  console.log(`[backfill] Skipped invalid records: ${stats.skippedInvalid}`);

  if (!apply) {
    console.log("[backfill] Run with --apply to persist predictions and update calibration.json");
  }
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err);
  process.exit(1);
});