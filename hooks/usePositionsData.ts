import { useCallback, useRef, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import type { Position } from "@/types/position.types";

export function usePositionsData() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [cashBalance, setCashBalance] = useState<number | undefined>(undefined);
  const [totalGainLoss, setTotalGainLoss] = useState<number | undefined>(undefined);
  const heldTickersRef = useRef<string[]>([]);

  const fetchPositions = useCallback(async () => {
    setRefreshing(true);
    try {
      const [posRes, balRes, pnlRes] = await Promise.all([
        authedFetch("/api/positions"),
        authedFetch("/api/balance"),
        authedFetch("/api/pnl"),
      ]);
      if (!posRes.ok) throw new Error(`Positions fetch failed: ${posRes.status}`);
      const data: Position[] = await posRes.json();
      const sortedData = [...data].sort((a, b) => b.marketValue - a.marketValue);
      setPositions(sortedData);
      setLastUpdated(new Date());
      if (balRes.ok) {
        const { cashBalance: cash } = await balRes.json();
        setCashBalance(cash);
      }
      if (pnlRes.ok) {
        const { totalPnL } = await pnlRes.json();
        setTotalGainLoss(totalPnL);
      }
      const tickers = data.map((position) => position.ticker);
      heldTickersRef.current = tickers;
      return tickers;
    } catch (err) {
      console.error("[dashboard] positions fetch error:", err);
      return heldTickersRef.current;
    } finally {
      setRefreshing(false);
    }
  }, []);

  return {
    positions,
    cashBalance,
    totalGainLoss,
    refreshing,
    lastUpdated,
    heldTickersRef,
    fetchPositions,
  };
}