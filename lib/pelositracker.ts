import { parse } from "devalue";
import type { CongressTrade } from "@/types/news.types";

/**
 * Congressional trade data source backed by pelositracker.app.
 *
 * pelositracker is a Nuxt 3 site that exposes its server-rendered payload as
 * JSON at `<route>/_payload.json`. We read that structured payload directly
 * instead of scraping HTML — it's far more robust than CSS selectors.
 *
 *   - Per-ticker trades:  /stock/{ticker}/_payload.json
 *       → data["transactions-all-{ticker}-{limit}"] = { compliantItems, nonCompliantItems, ... }
 *   - Member directory:   /politicians/_payload.json
 *       → array of { slug, party, title, ... } used to join party + chamber,
 *         which the per-ticker payload does not include.
 *
 * NOTE: this depends on a Nuxt *internal* serialization format that can change
 * on any redeploy of the third-party site. Every fetch/parse path degrades to
 * an empty result rather than throwing, so the positions news feed simply shows
 * "no congress data" if the format breaks.
 */

const BASE = "https://pelositracker.app";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_CONCURRENCY = 5;
const DIRECTORY_TTL_MS = 24 * 60 * 60 * 1000; // party/chamber rarely change

// Identity revivers for Nuxt's custom payload types — we only care about the
// plain values, so unwrap reactive/ref wrappers to their inner value.
const identity = <T>(v: T): T => v;
const NUXT_REVIVERS: Record<string, (value: unknown) => unknown> = {
  Reactive: identity,
  ShallowReactive: identity,
  Ref: identity,
  ShallowRef: identity,
  EmptyRef: () => undefined,
  EmptyShallowRef: () => undefined,
  NuxtError: identity,
};

interface PelosiTransaction {
  symbol?: string;
  name?: string;
  transactionType?: string; // "Stock" | "Options" | ...
  action?: string; // "Purchase" | "Sale"
  amountRange?: string;
  filedDate?: string;
  tradedDate?: string;
  excessReturn?: string;
  description?: string;
  link?: string;
  politicianName?: string;
  politicianSlug?: string;
  guid?: string;
  isCompliant?: boolean;
}

interface PoliticianMeta {
  party: "D" | "R" | "I";
  chamber: "house" | "senate";
}

async function fetchPayload(path: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}/_payload.json`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    return parse(text, NUXT_REVIVERS);
  } catch (err) {
    console.error(`[pelositracker] fetch/parse failed for ${path}:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function getDataBag(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  // Nuxt root is { data: {...}, ... } (with `data` already unwrapped by revivers)
  const data = (payload as { data?: unknown }).data;
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return payload as Record<string, unknown>;
}

// --- Politician directory (party + chamber), cached for 24h ---------------

let directoryCache: { map: Map<string, PoliticianMeta>; expiresAt: number } | null = null;

function mapParty(party: string | undefined): "D" | "R" | "I" {
  const p = (party ?? "").toLowerCase();
  if (p.startsWith("democrat")) return "D";
  if (p.startsWith("republican")) return "R";
  return "I";
}

async function getPoliticianDirectory(): Promise<Map<string, PoliticianMeta>> {
  if (directoryCache && directoryCache.expiresAt > Date.now()) {
    return directoryCache.map;
  }

  const map = new Map<string, PoliticianMeta>();
  const payload = await fetchPayload("/politicians");
  const data = getDataBag(payload);

  // The directory array lives somewhere under data; find the array of members.
  const members = data ? findMemberArray(data) : null;
  if (members) {
    for (const m of members) {
      if (!m.slug) continue;
      const meta: PoliticianMeta = {
        party: mapParty(m.party),
        chamber: (m.title ?? "").toLowerCase().includes("senator") ? "senate" : "house",
      };
      // Transactions reference members by canonical slug *or* alias, so index both.
      map.set(m.slug, meta);
      for (const alias of m.slugAliases ?? []) {
        if (alias) map.set(alias, meta);
      }
    }
  }

  // Cache even an empty map briefly so a transient outage doesn't hammer the site.
  directoryCache = {
    map,
    expiresAt: Date.now() + (map.size > 0 ? DIRECTORY_TTL_MS : 5 * 60 * 1000),
  };
  return map;
}

interface DirectoryMember {
  slug?: string;
  slugAliases?: string[];
  party?: string;
  title?: string;
}

function findMemberArray(root: unknown, depth = 0): DirectoryMember[] | null {
  if (depth > 5 || !root || typeof root !== "object") return null;
  if (Array.isArray(root)) {
    if (root.length && root[0] && typeof root[0] === "object" && "slug" in root[0] && "party" in root[0]) {
      return root as DirectoryMember[];
    }
    for (const item of root) {
      const found = findMemberArray(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const key of Object.keys(root)) {
    const found = findMemberArray((root as Record<string, unknown>)[key], depth + 1);
    if (found) return found;
  }
  return null;
}

// --- Per-ticker trades ----------------------------------------------------

function toUnix(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const ms = Date.parse(dateStr);
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

function mapTradeType(
  action: string | undefined,
  transactionType: string | undefined,
): CongressTrade["tradeType"] {
  const isOption = (transactionType ?? "").toLowerCase().includes("option");
  const isBuy = (action ?? "").toLowerCase() === "purchase";
  if (isBuy) return isOption ? "buy_option" : "buy";
  return isOption ? "sell_option" : "sell";
}

function extractTransactions(data: Record<string, unknown>, ticker: string): PelosiTransaction[] {
  // Match by prefix — the limit suffix ("-100") could change.
  const prefix = `transactions-all-${ticker.toLowerCase()}-`;
  const key = Object.keys(data).find((k) => k.startsWith(prefix));
  if (!key) return []; // no congressional activity for this ticker

  const node = data[key];
  if (!node || typeof node !== "object") return [];
  const bag = node as Record<string, unknown>;
  const compliant = Array.isArray(bag.compliantItems) ? (bag.compliantItems as PelosiTransaction[]) : [];
  const nonCompliant = Array.isArray(bag.nonCompliantItems)
    ? (bag.nonCompliantItems as PelosiTransaction[])
    : [];
  return [...compliant, ...nonCompliant];
}

async function fetchTickerTrades(
  ticker: string,
  directory: Map<string, PoliticianMeta>,
): Promise<CongressTrade[]> {
  const payload = await fetchPayload(`/stock/${ticker.toLowerCase()}`);
  const data = getDataBag(payload);
  if (!data) return [];

  const txns = extractTransactions(data, ticker);
  return txns
    .filter((t) => t.symbol && t.guid)
    .map((t) => {
      const slug = t.politicianSlug ?? "";
      const meta = directory.get(slug);
      return {
        id: t.guid as string,
        politician: t.politicianName ?? "Unknown",
        party: meta?.party ?? "I",
        chamber: meta?.chamber ?? "house",
        ticker: (t.symbol as string).toUpperCase(),
        companyName: t.name ?? (t.symbol as string).toUpperCase(),
        tradeType: mapTradeType(t.action, t.transactionType),
        assetType: t.transactionType ?? "Stock",
        amount: t.amountRange ?? "unknown",
        tradeDate: toUnix(t.tradedDate),
        filedDate: toUnix(t.filedDate),
        url: slug ? `${BASE}/politicians/${slug}` : `${BASE}/stock/${ticker.toLowerCase()}`,
      } satisfies CongressTrade;
    });
}

/** Resolve promises from `tasks` with bounded concurrency. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Fetch congressional trades for the given portfolio tickers from pelositracker.
 * Returns trades for all tickers combined, most recent first. Never throws —
 * failures for individual tickers degrade to no data for that ticker.
 */
export async function fetchCongressTrades(tickers: string[]): Promise<CongressTrade[]> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return [];

  const directory = await getPoliticianDirectory();
  const perTicker = await mapWithConcurrency(unique, MAX_CONCURRENCY, (ticker) =>
    fetchTickerTrades(ticker, directory),
  );

  // Flatten, dedupe by trade guid, sort newest-traded first.
  const seen = new Set<string>();
  const trades: CongressTrade[] = [];
  for (const list of perTicker) {
    for (const trade of list) {
      if (seen.has(trade.id)) continue;
      seen.add(trade.id);
      trades.push(trade);
    }
  }
  trades.sort((a, b) => b.tradeDate - a.tradeDate);
  return trades;
}
