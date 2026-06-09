/**
 * House ingester — parses Periodic Transaction Reports (PTRs) from the House
 * Clerk financial-disclosure dump into `congress_trades` rows.
 *
 * Pipeline (see docs/congress-official-scraper-plan.md, Phase 2):
 *   1. Download `{YEAR}FD.zip`, unzip in memory, parse `{YEAR}FD.xml`, keep
 *      FilingType=P (PTR) entries.
 *   2. Diff against the ingest log; for each new DocID fetch the PDF.
 *   3. Classify at fetch by content (not by DocID): real PDF → parse text;
 *      image-only → scanned (skip+count); HTML → 404 (skip+count).
 *   4. Parse with `getText()` + a line parser — PTR tables are text-positioned,
 *      not border-ruled, so pdf-parse's geometry table detector returns nothing.
 *
 * Party/bioguide are left null here and filled by the roster join (Phase 4).
 */

import { createHash } from "node:crypto";
import { unzipSync, strFromU8 } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { PDFParse } from "pdf-parse";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CongressTradeRow, IngestLogEntry, IngestStatus, TxType } from "./types";
import { getProcessedDocIds, logIngest, upsertTrades } from "./db";
import { loadRoster, type Roster } from "./roster";

const ZIP_BASE =
  "https://disclosures-clerk.house.gov/public_disc/financial-pdfs";
const PTR_BASE = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs";
const UA =
  "PulseHoldingsTracker/1.0 (+congress disclosure ingest; public-record data)";
const FETCH_TIMEOUT_MS = 30_000;

export interface HouseFiling {
  docId: string;
  last: string;
  first: string;
  prefix: string;
  suffix: string;
  stateDst: string; // e.g. "AL04" — used for the roster join
  filingDate: string; // M/D/YYYY as it appears in the XML
  year: number;
}

// ── Index ───────────────────────────────────────────────────────────────────

async function fetchBytes(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Download + unzip + parse `{YEAR}FD.xml`, returning only PTR (FilingType=P) entries. */
export async function fetchHousePtrIndex(year: number): Promise<HouseFiling[]> {
  const res = await fetchBytes(`${ZIP_BASE}/${year}FD.zip`);
  if (!res.ok) throw new Error(`[congress/house] index ${year} → HTTP ${res.status}`);
  const zip = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const xmlBytes = zip[`${year}FD.xml`];
  if (!xmlBytes) throw new Error(`[congress/house] ${year}FD.xml missing from zip`);

  const parsed = new XMLParser().parse(strFromU8(xmlBytes));
  const raw = parsed?.FinancialDisclosure?.Member;
  const members: Record<string, unknown>[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return members
    .filter((m) => String(m.FilingType) === "P")
    .map((m) => ({
      docId: String(m.DocID),
      last: String(m.Last ?? "").trim(),
      first: String(m.First ?? "").trim(),
      prefix: String(m.Prefix ?? "").trim(),
      suffix: String(m.Suffix ?? "").trim(),
      stateDst: String(m.StateDst ?? "").trim(),
      filingDate: String(m.FilingDate ?? "").trim(),
      year,
    }));
}

// ── Document fetch + classify ─────────────────────────────────────────────────

export interface FetchedPtr {
  status: IngestStatus;
  text?: string;
  detail?: string;
}

/** Fetch one PTR PDF and classify it by content (digital text / scanned / 404). */
export async function fetchPtrDocument(docId: string, year: number): Promise<FetchedPtr> {
  const url = `${PTR_BASE}/${year}/${docId}.pdf`;
  let res: Response;
  try {
    res = await fetchBytes(url);
  } catch (e) {
    return { status: "error", detail: (e as Error).message };
  }
  if (res.status === 404) return { status: "not_found", detail: "404" };
  if (!res.ok) return { status: "error", detail: `HTTP ${res.status}` };

  const bytes = new Uint8Array(await res.arrayBuffer());
  // HTML body (some "PDF" links 404 with a 200 + HTML page) → not a filing.
  const head = new TextDecoder().decode(bytes.slice(0, 5));
  if (head !== "%PDF-") return { status: "not_found", detail: "non-pdf body" };

  try {
    const parser = new PDFParse({ data: bytes });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text ?? "";
    // Scanned/image-only PTRs yield (almost) no extractable text.
    if (stripNulls(text).replace(/\s+/g, "").length < 40) {
      return { status: "scanned", detail: "no extractable text" };
    }
    return { status: "parsed", text };
  } catch (e) {
    return { status: "error", detail: `pdf-parse: ${(e as Error).message}` };
  }
}

// ── Parser ────────────────────────────────────────────────────────────────────

const stripNulls = (s: string) => s.replace(/\u0000/g, "");

// A transaction line: action code, transaction date, notification date, amount.
// Action may be inline after the asset text, so we search anywhere in the line.
const TX_RE =
  /(?:^|[\t ])(P|S|E)(?:\s*\(partial\))?[\t ]+(\d{2}\/\d{2}\/\d{4})[\t ]+(\d{2}\/\d{2}\/\d{4})[\t ]+(\$[\d,]+.*)$/;
// Ticker + asset-type code, e.g. "(BRK.B) [OP]", "(GSK) [ST]". Codes are 2+ caps.
const TICKER_RE = /\(([A-Za-z0-9.\-]{1,8})\)\s*\[([A-Z]{2,})\]/g;
// Trailer / metadata lines that are not part of an asset name.
const TRAILER_RE = /^(F\s+S\s*:|S\s+O\s*:|D\s*:|L\s*:|ID\b|Type$|Date\b|Amount\b|Gains|\$200|Owner Asset|Notification|Filing ID|--\s*\d+\s*of\s*\d+\s*--|Clerk of the House|\* For the complete|Name:|Status:|State\/District:|I CERTIFY|Digitally Signed|Yes No)/i;
// Letterspaced section headings collapse to single caps after NUL strip, e.g.
// "P T R" (Periodic Transaction Report), "F I" (Filing Information), "T".
const HEADING_RE = /^[A-Z]( +[A-Z])*$/;

/** Buffer a line only if it's plausibly part of an asset name (not noise). */
function pushAsset(buffer: string[], line: string): void {
  const t = line.trim();
  if (t && !TRAILER_RE.test(t) && !HEADING_RE.test(t)) buffer.push(t);
}

function toISO(mdy: string): string | null {
  const m = mdy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function normalizeAmount(raw: string, nextLine: string | undefined): { amount: string; consumedNext: boolean } {
  let amt = raw.replace(/\s+/g, " ").trim();
  // Drop a trailing cap-gains checkbox if one slipped in.
  amt = amt.replace(/\s*(Yes|No)\s*$/i, "").trim();
  // Wrapped amount: "$15,001 -" continues with "$50,000" on the next line.
  if (/-\s*$/.test(amt) && nextLine && /^\$?[\d,]+/.test(nextLine.trim())) {
    return { amount: `${amt} ${nextLine.trim()}`.replace(/\s+/g, " "), consumedNext: true };
  }
  return { amount: amt, consumedNext: false };
}

function companyFromBuffer(tickerMatchIndex: number, joined: string): string | null {
  // Text up to the ticker is the asset name; strip the owner-code prefix.
  const name = joined
    .slice(0, tickerMatchIndex)
    .replace(/^(JT|SP|DC)\b\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return name.length ? name : null;
}

function classifyTxType(action: string, typeCode: string): TxType | null {
  const option = typeCode.toUpperCase() === "OP";
  if (action === "P") return option ? "buy_option" : "buy";
  if (action === "S") return option ? "sell_option" : "sell";
  return null; // E (exchange) is not representable — skip + count
}

export interface ParseResult {
  rows: CongressTradeRow[];
  detected: number; // transaction lines matched
  skippedNoTicker: number;
  skippedExchange: number;
}

/** Parse one digital House PTR's extracted text into trade rows. */
export function parseHousePtr(rawText: string, filing: HouseFiling): ParseResult {
  const url = `${PTR_BASE}/${filing.year}/${filing.docId}.pdf`;
  const politician = [filing.first, filing.last].filter(Boolean).join(" ").trim();
  const filedDate = toISO(filing.filingDate);

  const lines = stripNulls(rawText)
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00a0/g, " ").trimEnd());

  const rows: CongressTradeRow[] = [];
  let buffer: string[] = []; // asset lines accumulated since the last transaction
  let detected = 0;
  let skippedNoTicker = 0;
  let skippedExchange = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const m = line.match(TX_RE);
    if (!m) {
      pushAsset(buffer, line);
      continue;
    }

    // Any text before the action on this line is asset text (inline-action case).
    pushAsset(buffer, line.slice(0, m.index ?? 0));

    detected++;
    const txIndex = detected - 1; // stable positional row index (duplicates kept)

    const action = m[1];
    const tradedDate = toISO(m[2]);
    const { amount, consumedNext } = normalizeAmount(m[4], lines[i + 1]);
    if (consumedNext) i++;

    // Ticker = the LAST "(TICKER) [TYPE]" seen in the asset buffer.
    const joined = buffer.join(" ");
    TICKER_RE.lastIndex = 0;
    let last: RegExpExecArray | null = null;
    for (let mm = TICKER_RE.exec(joined); mm; mm = TICKER_RE.exec(joined)) last = mm;

    buffer = []; // consume the asset block

    if (!last) {
      skippedNoTicker++;
      continue;
    }
    const ticker = last[1].toUpperCase();
    const typeCode = last[2];
    const txType = classifyTxType(action, typeCode);
    if (!txType) {
      skippedExchange++;
      continue;
    }

    const company = companyFromBuffer(last.index, joined);
    const contentHash = createHash("sha256")
      .update([ticker, action, m[2], m[3], amount].join("|"))
      .digest("hex")
      .slice(0, 16);

    rows.push({
      id: `house-${filing.docId}-${txIndex}`,
      source: "house",
      doc_id: filing.docId,
      row_index: txIndex,
      politician,
      bioguide_id: null,
      party: null,
      chamber: "house",
      ticker,
      company_name: company,
      asset_type: typeCode,
      tx_type: txType,
      amount_range: amount || null,
      traded_date: tradedDate,
      filed_date: filedDate,
      comment: null,
      url,
      content_hash: contentHash,
    });
  }

  return { rows, detected, skippedNoTicker, skippedExchange };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export interface HouseIngestStats {
  filings: number; // PTRs in the index across the requested years
  considered: number; // new filings after diffing the ingest log
  parsed: number;
  scanned: number;
  notFound: number;
  errors: number;
  rowsUpserted: number;
  skippedNoTicker: number;
  skippedExchange: number;
}

/**
 * Full House ingest: download the year index, diff against the ingest log,
 * fetch + parse each new PTR, upsert rows, and record per-filing status.
 * Idempotent — already-logged DocIDs are skipped unless `force` is set.
 */
export async function ingestHouse(opts: {
  supabase: SupabaseClient;
  years?: number[];
  limit?: number;
  force?: boolean;
  delayMs?: number;
  logger?: (msg: string) => void;
}): Promise<HouseIngestStats> {
  const log = opts.logger ?? (() => {});
  const years = opts.years ?? [new Date().getUTCFullYear()];
  const delayMs = opts.delayMs ?? 120;

  const filings: HouseFiling[] = [];
  for (const y of years) {
    const idx = await fetchHousePtrIndex(y);
    log(`[house] ${y}: ${idx.length} PTR filings in index`);
    filings.push(...idx);
  }

  let roster: Roster | null = null;
  try {
    roster = await loadRoster();
  } catch (e) {
    log(`[house] roster load failed (party/bioguide left null): ${(e as Error).message}`);
  }

  const processed = opts.force
    ? new Set<string>()
    : await getProcessedDocIds(opts.supabase, "house");
  let todo = filings.filter((f) => !processed.has(f.docId));
  if (opts.limit) todo = todo.slice(0, opts.limit);
  log(`[house] ${todo.length} new filings to process (${processed.size} already logged)`);

  const stats: HouseIngestStats = {
    filings: filings.length,
    considered: todo.length,
    parsed: 0,
    scanned: 0,
    notFound: 0,
    errors: 0,
    rowsUpserted: 0,
    skippedNoTicker: 0,
    skippedExchange: 0,
  };

  const allRows: CongressTradeRow[] = [];
  const logEntries: IngestLogEntry[] = [];

  for (const f of todo) {
    const doc = await fetchPtrDocument(f.docId, f.year);
    let rowCount: number | null = null;
    if (doc.status === "parsed" && doc.text) {
      const r = parseHousePtr(doc.text, f);
      const match = roster?.resolveHouse(f.stateDst, f.last) ?? null;
      for (const row of r.rows) {
        row.bioguide_id = match?.bioguideId ?? null;
        row.party = match?.party ?? null;
      }
      allRows.push(...r.rows);
      rowCount = r.rows.length;
      stats.parsed++;
      stats.skippedNoTicker += r.skippedNoTicker;
      stats.skippedExchange += r.skippedExchange;
    } else if (doc.status === "scanned") stats.scanned++;
    else if (doc.status === "not_found") stats.notFound++;
    else stats.errors++;

    logEntries.push({
      source: "house",
      doc_id: f.docId,
      status: doc.status,
      row_count: rowCount,
      detail: doc.detail ?? null,
    });
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }

  await upsertTrades(opts.supabase, allRows);
  await logIngest(opts.supabase, logEntries);
  stats.rowsUpserted = allRows.length;
  log(
    `[house] done: parsed=${stats.parsed} scanned=${stats.scanned} ` +
      `notFound=${stats.notFound} errors=${stats.errors} rows=${stats.rowsUpserted}`,
  );
  return stats;
}
