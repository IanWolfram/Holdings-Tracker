/**
 * Senate ingester — parses Periodic Transaction Reports from the Senate eFD
 * system (`efdsearch.senate.gov`) into `congress_trades` rows.
 *
 * Senate is easier than House: the electronic PTR view is a clean HTML table
 * with the ticker in its own column. The friction is the access handshake:
 *   1. GET  /search/home/      → csrfmiddlewaretoken + csrftoken cookie
 *   2. POST /search/home/      with prohibition_agreement=1 → 302, cookie armed
 *   3. POST /search/report/data/ with report_types=[11] (PTR) → JSON rows
 *   4. GET  /search/view/ptr/{uuid}/ → HTML table → cheerio parse
 *
 * Paper PTRs (`/search/view/paper/{uuid}/`) are scanned images → skip + count.
 * Party/bioguide are left null here and filled by the roster join (Phase 4).
 */

import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CongressTradeRow, IngestLogEntry, TxType } from "./types";
import { getProcessedDocIds, logIngest, upsertTrades } from "./db";
import { loadRoster, type Roster } from "./roster";

const BASE = "https://efdsearch.senate.gov";
const UA =
  "PulseHoldingsTracker/1.0 (+congress disclosure ingest; public-record data)";
const FETCH_TIMEOUT_MS = 30_000;
const REPORT_TYPE_PTR = "[11]";

// ── Session (cookie jar + CSRF handshake) ─────────────────────────────────────

/** A search result row: [first, last, "Last, First (Senator)", <a href…>, date]. */
type SearchRow = [string, string, string, string, string];

export interface SenateFiling {
  uuid: string;
  first: string;
  last: string;
  filedDate: string; // MM/DD/YYYY (submitted date)
  isPaper: boolean;
}

export class SenateSession {
  private jar = new Map<string, string>();
  private formToken = "";

  private cookieHeader(): string {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private absorb(res: Response): void {
    for (const c of res.headers.getSetCookie()) {
      const pair = c.split(";")[0];
      const i = pair.indexOf("=");
      if (i > 0) this.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  private async req(path: string, init: RequestInit = {}): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          "User-Agent": UA,
          Cookie: this.cookieHeader(),
          Referer: `${BASE}/search/`,
          ...(init.headers ?? {}),
        },
        signal: ctrl.signal,
      });
      this.absorb(res);
      return res;
    } finally {
      clearTimeout(t);
    }
  }

  /** Perform the GET + agreement POST so the session cookie accepts searches. */
  async init(): Promise<void> {
    const home = await this.req("/search/home/", { headers: { Referer: `${BASE}/` } });
    const html = await home.text();
    this.formToken =
      html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1] ??
      this.jar.get("csrftoken") ??
      "";
    if (!this.formToken) throw new Error("[congress/senate] no CSRF token on /search/home/");

    const res = await this.req("/search/home/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${BASE}/search/home/`,
      },
      body: new URLSearchParams({
        csrfmiddlewaretoken: this.formToken,
        prohibition_agreement: "1",
      }),
      redirect: "manual",
    });
    if (res.status !== 302) {
      throw new Error(`[congress/senate] agreement POST → HTTP ${res.status} (expected 302)`);
    }
  }

  /** Page through PTR search results submitted on/after `sinceMDY` (MM/DD/YYYY). */
  async searchPtrs(sinceMDY: string): Promise<SenateFiling[]> {
    const token = this.jar.get("csrftoken") ?? this.formToken;
    const out: SenateFiling[] = [];
    const PAGE = 100;
    for (let start = 0; ; start += PAGE) {
      const res = await this.req("/search/report/data/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRFToken": token,
        },
        body: new URLSearchParams({
          start: String(start),
          length: String(PAGE),
          report_types: REPORT_TYPE_PTR,
          filer_types: "[]",
          submitted_start_date: `${sinceMDY} 00:00:00`,
          submitted_end_date: "",
          candidate_state: "",
          senator_state: "",
          office_id: "",
          first_name: "",
          last_name: "",
          csrfmiddlewaretoken: token,
        }),
      });
      if (!res.ok) throw new Error(`[congress/senate] search → HTTP ${res.status}`);
      const json = (await res.json()) as { data?: SearchRow[]; recordsTotal?: number };
      const rows = json.data ?? [];
      if (rows.length === 0) break;

      for (const row of rows) {
        const href = row[3].match(/href="([^"]+)"/)?.[1] ?? "";
        const isPaper = href.includes("/paper/");
        const uuid = href.match(/\/(?:ptr|paper)\/([0-9a-f-]+)\//i)?.[1];
        if (!uuid) continue;
        out.push({ uuid, first: row[0], last: row[1], filedDate: row[4], isPaper });
      }
      if (rows.length < PAGE) break;
    }
    return out;
  }

  /** Fetch the raw HTML of an electronic PTR view. */
  async fetchPtrView(uuid: string): Promise<string> {
    const res = await this.req(`/search/view/ptr/${uuid}/`);
    if (!res.ok) throw new Error(`[congress/senate] view ${uuid} → HTTP ${res.status}`);
    return res.text();
  }
}

// ── Parser ────────────────────────────────────────────────────────────────────

function toISO(mdy: string): string | null {
  const m = mdy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function classifyTxType(rawType: string, assetType: string): TxType | null {
  const option = /option/i.test(assetType) || /option/i.test(rawType);
  const t = rawType.toLowerCase();
  if (t.startsWith("purchase")) return option ? "buy_option" : "buy";
  if (t.startsWith("sale")) return option ? "sell_option" : "sell";
  return null; // "Exchange" et al. are not representable — skip + count
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const orNull = (s: string) => (s && s !== "--" ? s : null);

export interface ParseResult {
  rows: CongressTradeRow[];
  detected: number;
  skippedNoTicker: number;
  skippedExchange: number;
}

/** Parse one electronic Senate PTR's HTML table into trade rows. */
export function parseSenatePtr(html: string, filing: SenateFiling): ParseResult {
  const $ = load(html);
  const url = `${BASE}/search/view/ptr/${filing.uuid}/`;
  const politician = [filing.first, filing.last].filter(Boolean).join(" ").trim();
  const filedDate = toISO(filing.filedDate);

  const rows: CongressTradeRow[] = [];
  let detected = 0;
  let skippedNoTicker = 0;
  let skippedExchange = 0;

  $("table tbody tr").each((_, tr) => {
    const c = $(tr)
      .find("td")
      .map((_i, td) => clean($(td).text()))
      .get();
    // Columns: # · Date · Owner · Ticker · Asset Name · Asset Type · Type · Amount · Comment
    if (c.length < 8) return;
    detected++;

    const num = parseInt(c[0], 10);
    const rowIndex = Number.isFinite(num) ? num : detected;
    const ticker = orNull(c[3]);
    if (!ticker) {
      skippedNoTicker++;
      return;
    }
    const assetType = c[5];
    const txType = classifyTxType(c[6], assetType);
    if (!txType) {
      skippedExchange++;
      return;
    }

    const tradedDate = toISO(c[1]);
    const amount = orNull(c[7]);
    const contentHash = createHash("sha256")
      .update([ticker, c[6], c[1], filing.filedDate, c[7]].join("|"))
      .digest("hex")
      .slice(0, 16);

    rows.push({
      id: `senate-${filing.uuid}-${rowIndex}`,
      source: "senate",
      doc_id: filing.uuid,
      row_index: rowIndex,
      politician,
      bioguide_id: null,
      party: null,
      chamber: "senate",
      ticker: ticker.toUpperCase(),
      company_name: orNull(c[4]),
      asset_type: orNull(assetType),
      tx_type: txType,
      amount_range: amount,
      traded_date: tradedDate,
      filed_date: filedDate,
      comment: c.length >= 9 ? orNull(c[8]) : null,
      url,
      content_hash: contentHash,
    });
  });

  return { rows, detected, skippedNoTicker, skippedExchange };
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export interface SenateIngestStats {
  filings: number;
  considered: number;
  parsed: number;
  paper: number;
  errors: number;
  rowsUpserted: number;
  skippedNoTicker: number;
  skippedExchange: number;
}

/**
 * Full Senate ingest: handshake, search PTRs since `since`, diff against the
 * ingest log, fetch + parse each new electronic report, upsert rows, and record
 * per-filing status. Paper (scanned) PTRs are logged and skipped.
 */
export async function ingestSenate(opts: {
  supabase: SupabaseClient;
  since?: string; // MM/DD/YYYY, default 01/01 of last year
  limit?: number;
  force?: boolean;
  delayMs?: number;
  logger?: (msg: string) => void;
}): Promise<SenateIngestStats> {
  const log = opts.logger ?? (() => {});
  const since = opts.since ?? `01/01/${new Date().getUTCFullYear() - 1}`;
  const delayMs = opts.delayMs ?? 150;

  const session = new SenateSession();
  await session.init();
  const filings = await session.searchPtrs(since);
  log(`[senate] ${filings.length} PTR filings since ${since}`);

  let roster: Roster | null = null;
  try {
    roster = await loadRoster();
  } catch (e) {
    log(`[senate] roster load failed (party/bioguide left null): ${(e as Error).message}`);
  }

  const processed = opts.force
    ? new Set<string>()
    : await getProcessedDocIds(opts.supabase, "senate");
  let todo = filings.filter((f) => !processed.has(f.uuid));
  if (opts.limit) todo = todo.slice(0, opts.limit);
  log(`[senate] ${todo.length} new filings to process (${processed.size} already logged)`);

  const stats: SenateIngestStats = {
    filings: filings.length,
    considered: todo.length,
    parsed: 0,
    paper: 0,
    errors: 0,
    rowsUpserted: 0,
    skippedNoTicker: 0,
    skippedExchange: 0,
  };

  const allRows: CongressTradeRow[] = [];
  const logEntries: IngestLogEntry[] = [];

  for (const f of todo) {
    if (f.isPaper) {
      stats.paper++;
      logEntries.push({ source: "senate", doc_id: f.uuid, status: "scanned", row_count: null, detail: "paper PTR" });
      continue;
    }
    try {
      const html = await session.fetchPtrView(f.uuid);
      const r = parseSenatePtr(html, f);
      const match = roster?.resolveSenate(f.first, f.last) ?? null;
      for (const row of r.rows) {
        row.bioguide_id = match?.bioguideId ?? null;
        row.party = match?.party ?? null;
      }
      allRows.push(...r.rows);
      stats.parsed++;
      stats.skippedNoTicker += r.skippedNoTicker;
      stats.skippedExchange += r.skippedExchange;
      logEntries.push({ source: "senate", doc_id: f.uuid, status: "parsed", row_count: r.rows.length, detail: null });
    } catch (e) {
      stats.errors++;
      logEntries.push({ source: "senate", doc_id: f.uuid, status: "error", row_count: null, detail: (e as Error).message });
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }

  await upsertTrades(opts.supabase, allRows);
  await logIngest(opts.supabase, logEntries);
  stats.rowsUpserted = allRows.length;
  log(
    `[senate] done: parsed=${stats.parsed} paper=${stats.paper} errors=${stats.errors} rows=${stats.rowsUpserted}`,
  );
  return stats;
}
