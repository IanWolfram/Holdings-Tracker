import { useEffect, useState } from "react";
import { getMarketStatus, type MarketStatus } from "@/lib/marketHours";

const MARKET_TICK_MS = 30_000;

export function useMarketStatus() {
  const [market, setMarket] = useState<MarketStatus>(() => getMarketStatus());

  useEffect(() => {
    const tick = () => setMarket(getMarketStatus());
    const id = setInterval(tick, MARKET_TICK_MS);
    return () => clearInterval(id);
  }, []);

  return market;
}
