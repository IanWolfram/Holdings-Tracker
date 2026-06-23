import { useCallback, useEffect, useRef } from "react";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import { useAccount } from "@/components/providers/UserAccountProvider";
import { usePositionsData } from "./usePositionsData";
import { useNews } from "./useNews";
import { useCongress } from "./useCongress";
import { useAgentState } from "./useAgentState";
import { useProposedPositions } from "./useProposedPositions";
import { useProposedQuotes } from "./useProposedQuotes";

const CONGRESS_POLL_MS = 60_000;

export function useDashboardData() {
  const {
    positions,
    cashBalance,
    totalGainLoss,
    refreshing,
    lastUpdated,
    heldTickersRef,
    fetchPositions,
  } = usePositionsData();

  const { preferences } = useAccount();
  const analyzedAge = preferences?.analyzedMaxAgeDays;

  const { news, setNews, loadingNews, fetchNews } = useNews();
  const { congressTrades, fetchCongress } = useCongress();
  const {
    agentState,
    predictions,
    fetchPredictions,
    analyzingTickers,
    analyzeTicker,
  } = useAgentState(setNews);

  const {
    proposedEntries,
    proposedTickers,
    addProposedPosition,
    removeProposedPosition,
  } = useProposedPositions(positions.map((p) => p.ticker));

  const { proposedPositionData } = useProposedQuotes(proposedEntries);

  // ── Polling intervals ──────────────────────────────────────────────────
  const mainIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const congressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Latest watchlist tickers, read at fire-time by the analyzed-age effect
  // (proposedTickers' array reference is unstable; a ref keeps the effect deps clean).
  const proposedTickersRef = useRef<string[]>(proposedTickers);
  proposedTickersRef.current = proposedTickers;

  const refresh = useCallback(async () => {
    const tickers = await fetchPositions();
    if (tickers.length > 0) {
      await Promise.all([
        fetchNews(tickers),
        fetchCongress(tickers),
        fetchPredictions(),
      ]);
    }
  }, [fetchPositions, fetchNews, fetchCongress, fetchPredictions]);

  // Main polling: positions + derived data
  useEffect(() => {
    refresh();
    mainIntervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (mainIntervalRef.current) clearInterval(mainIntervalRef.current);
    };
  }, [refresh]);

  // Congress-specific 60s refresh for held tickers
  useEffect(() => {
    congressIntervalRef.current = setInterval(() => {
      fetchCongress(heldTickersRef.current);
    }, CONGRESS_POLL_MS);
    return () => {
      if (congressIntervalRef.current) clearInterval(congressIntervalRef.current);
    };
  }, [fetchCongress, heldTickersRef]);

  // ── Retry & side effects ───────────────────────────────────────────────

  // When positions arrive without history, re-fetch sooner so graphs populate
  useEffect(() => {
    const missingHistory = positions.some(
      (p) => !p.history || p.history.length < 2
    );
    if (!missingHistory) return;
    const timer = setTimeout(refresh, 15_000);
    return () => clearTimeout(timer);
  }, [positions, refresh]);

  // Fetch news/congress/predictions for proposed (watchlist) tickers
  useEffect(() => {
    if (proposedTickers.length === 0) return;
    fetchNews(proposedTickers);
    fetchCongress(proposedTickers);
    fetchPredictions();
  }, [proposedTickers, fetchNews, fetchCongress, fetchPredictions]);

  // When the "analyzed news age" preference changes, silently re-fetch news for
  // all visible tickers so PositionCards update immediately instead of waiting
  // for the next poll or a page reload. The server trims to the new age on a
  // cache hit, so this is cheap; `silent` avoids flashing the cards' loading glow.
  const prevAnalyzedAgeRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (analyzedAge === undefined) return;
    const prev = prevAnalyzedAgeRef.current;
    prevAnalyzedAgeRef.current = analyzedAge;
    if (prev === undefined || prev === analyzedAge) return; // first load / no-op
    const tickers = [...heldTickersRef.current, ...proposedTickersRef.current];
    if (tickers.length > 0) fetchNews(tickers, { silent: true });
  }, [analyzedAge, fetchNews, heldTickersRef]);

  // ── Public API (unchanged) ─────────────────────────────────────────────

  return {
    positions,
    proposedPositionData,
    proposedEntries,
    proposedTickers,
    addProposedPosition,
    removeProposedPosition,
    news,
    congressTrades,
    loadingNews,
    refreshing,
    lastUpdated,
    cashBalance,
    totalGainLoss,
    agentState,
    predictions,
    analyzingTickers,
    analyzeTicker,
    refresh,
  };
}