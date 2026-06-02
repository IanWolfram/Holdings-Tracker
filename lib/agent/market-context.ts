import type { MacroSnapshot } from "../marketdata/macro";

export interface MarketContextDigest {
  /** Plain-text block injected verbatim into each analyzeStory prompt. */
  text: string;
}

/**
 * Builds a portfolio-wide market & sector context digest, injected once per sweep
 * into every analyzeStory call so the brain reasons with macro regime and the
 * portfolio's own sector spread in view.
 *
 * Reconstructed to derive entirely from data already gathered earlier in the sweep
 * (the macro snapshot and each holding's resolved sector) so it adds no network
 * calls on a path callers treat as non-fatal. The originally-commented intent
 * (peer quotes, sector-ETF moves, broad-market news) was never implemented; widen
 * this if that richer, network-backed context is wanted.
 *
 * Returns `undefined` when there is nothing meaningful to say, so callers can do
 * `digest?.text`.
 */
export async function buildMarketContextDigest(
  holdingTickers: string[],
  holdingSectorMap: Record<string, string>,
  macroSnapshot: MacroSnapshot | null
): Promise<MarketContextDigest | undefined> {
  const lines: string[] = [];

  if (macroSnapshot) {
    lines.push(...buildMacroLines(macroSnapshot));
  }

  const sectorLine = buildSectorLine(holdingTickers, holdingSectorMap);
  if (sectorLine) lines.push(sectorLine);

  if (lines.length === 0) return undefined;
  return { text: lines.join("\n") };
}

function buildMacroLines(macro: MacroSnapshot): string[] {
  const lines: string[] = [`Macro regime: ${macro.regime}.`];

  const metrics: string[] = [];
  if (macro.vix !== null) {
    metrics.push(`VIX ${macro.vix.toFixed(1)}${formatWow(macro.vixWow)}`);
  }
  if (macro.tenY !== null) {
    metrics.push(`10Y ${macro.tenY.toFixed(2)}%${formatWow(macro.tenYWow)}`);
  }
  if (macro.dxy !== null) {
    metrics.push(`DXY ${macro.dxy.toFixed(2)} (${macro.dxyTrend})${formatWow(macro.dxyWow)}`);
  }
  if (metrics.length > 0) {
    lines.push(metrics.join(" · "));
  }

  if (macro.summary?.trim()) {
    lines.push(macro.summary.trim());
  }

  return lines;
}

/** Renders a week-over-week delta like " (+1.2 w/w)", or "" when unavailable. */
function formatWow(wow: number | null): string {
  if (wow === null || wow === 0) return "";
  const sign = wow > 0 ? "+" : "";
  return ` (${sign}${wow.toFixed(2)} w/w)`;
}

/** One line describing how the portfolio's holdings are spread across sectors. */
function buildSectorLine(
  holdingTickers: string[],
  holdingSectorMap: Record<string, string>
): string | null {
  const bySector = new Map<string, string[]>();
  for (const ticker of holdingTickers) {
    const sector = holdingSectorMap[ticker.toUpperCase()];
    if (!sector) continue;
    const list = bySector.get(sector) ?? [];
    list.push(ticker.toUpperCase());
    bySector.set(sector, list);
  }

  if (bySector.size === 0) return null;

  const parts = [...bySector.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([sector, tickers]) => `${sector} (${tickers.join(", ")})`);

  return `Portfolio sector exposure: ${parts.join("; ")}.`;
}
