import { API_TIMEOUT_MS } from "../constants";

export type MacroRegime = "risk-on" | "risk-off" | "neutral";
export type TrendDirection = "rising" | "falling" | "flat" | "unknown";

export interface MacroSnapshot {
  asOf: string;
  vix: number | null;
  tenY: number | null;
  dxy: number | null;
  fedFunds: number | null;
  cpi: number | null;
  dxyTrend: TrendDirection;
  regime: MacroRegime;
  vixWow: number | null;
  tenYWow: number | null;
  dxyWow: number | null;
  summary: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000;

const SERIES_IDS = {
  vix: "VIXCLS",
  tenY: "DGS10",
  dxy: "DTWEXBGS",
  fedFunds: "DFF",
  cpi: "CPIAUCSL",
} as const;

let cache: { data: MacroSnapshot; expiresAt: number } | null = null;

interface SeriesSample {
  latest: number | null;
  previous: number | null;
  weekAgo: number | null;
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function trend(latest: number | null, previous: number | null): TrendDirection {
  if (latest === null || previous === null) return "unknown";
  const diff = latest - previous;
  if (Math.abs(diff) < 0.0001) return "flat";
  return diff > 0 ? "rising" : "falling";
}

function classifyRegime(vix: number | null, dxyTrend: TrendDirection): MacroRegime {
  if (vix !== null && vix > 18 && dxyTrend === "rising") {
    return "risk-off";
  }
  if (vix !== null && vix < 18 && (dxyTrend === "falling" || dxyTrend === "flat")) {
    return "risk-on";
  }
  return "neutral";
}

function wowChange(current: number | null, weekAgo: number | null): string {
  if (current === null || weekAgo === null) return "";
  const diff = current - weekAgo;
  const pct = weekAgo !== 0 ? (diff / Math.abs(weekAgo)) * 100 : 0;
  const sign = diff >= 0 ? "+" : "";
  return ` (${sign}${pct.toFixed(1)}% WoW)`;
}

function buildSummary(snapshot: MacroSnapshot): string {
  const vixText = snapshot.vix === null ? "VIX unavailable" : `VIX ${snapshot.vix.toFixed(2)}${wowChange(snapshot.vix, snapshot.vixWow)}`;
  const dxyText = snapshot.dxy === null
    ? "DXY unavailable"
    : `DXY ${snapshot.dxy.toFixed(2)} (${snapshot.dxyTrend})${wowChange(snapshot.dxy, snapshot.dxyWow)}`;
  const tenYText = snapshot.tenY === null ? "10Y unavailable" : `10Y ${snapshot.tenY.toFixed(2)}%${wowChange(snapshot.tenY, snapshot.tenYWow)}`;
  const regimeText =
    snapshot.regime === "risk-off"
      ? "Conditions lean defensive — elevated volatility with dollar strength."
      : snapshot.regime === "risk-on"
        ? "Conditions lean constructive — subdued volatility, risk appetite intact."
        : "No strong directional tilt in macro conditions.";

  return `${vixText}, ${tenYText}, ${dxyText}. ${regimeText}`;
}

async function fetchSeriesSample(seriesId: string, apiKey: string): Promise<SeriesSample> {
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(apiKey)}` +
    `&file_type=json&sort_order=desc&limit=20`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`FRED ${seriesId} HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    observations?: Array<{ value?: string }>;
  };

  const numericValues = (json.observations ?? [])
    .map((obs) => Number(obs.value))
    .filter((v) => Number.isFinite(v));

  return {
    latest: numericValues[0] ?? null,
    previous: numericValues[1] ?? null,
    // FRED returns most-recent-first; observations ~5 business days back
    weekAgo: numericValues[4] ?? null,
  };
}

function snapshotWithoutKey(): MacroSnapshot {
  return {
    asOf: new Date().toISOString(),
    vix: null,
    tenY: null,
    dxy: null,
    fedFunds: null,
    cpi: null,
    dxyTrend: "unknown",
    regime: "neutral",
    vixWow: null,
    tenYWow: null,
    dxyWow: null,
    summary: "FRED_API_KEY is not configured, so macro regime defaults to neutral.",
  };
}

export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.data;
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    const fallback = snapshotWithoutKey();
    cache = { data: fallback, expiresAt: now + CACHE_TTL_MS };
    return fallback;
  }

  try {
    const [vix, tenY, dxy, fedFunds, cpi] = await Promise.all([
      fetchSeriesSample(SERIES_IDS.vix, apiKey),
      fetchSeriesSample(SERIES_IDS.tenY, apiKey),
      fetchSeriesSample(SERIES_IDS.dxy, apiKey),
      fetchSeriesSample(SERIES_IDS.fedFunds, apiKey),
      fetchSeriesSample(SERIES_IDS.cpi, apiKey),
    ]);

    const dxyTrend = trend(dxy.latest, dxy.previous);
    const snapshot: MacroSnapshot = {
      asOf: new Date().toISOString(),
      vix: vix.latest === null ? null : round(vix.latest, 2),
      tenY: tenY.latest === null ? null : round(tenY.latest, 2),
      dxy: dxy.latest === null ? null : round(dxy.latest, 2),
      fedFunds: fedFunds.latest === null ? null : round(fedFunds.latest, 2),
      cpi: cpi.latest === null ? null : round(cpi.latest, 2),
      dxyTrend,
      vixWow: vix.weekAgo,
      tenYWow: tenY.weekAgo,
      dxyWow: dxy.weekAgo,
      regime: classifyRegime(vix.latest, dxyTrend),
      summary: "",
    };

    snapshot.summary = buildSummary(snapshot);
    cache = { data: snapshot, expiresAt: now + CACHE_TTL_MS };
    return snapshot;
  } catch (err) {
    console.warn("[macro] Failed to fetch FRED data:", (err as Error).message);
    const fallback = snapshotWithoutKey();
    cache = { data: fallback, expiresAt: now + CACHE_TTL_MS };
    return fallback;
  }
}