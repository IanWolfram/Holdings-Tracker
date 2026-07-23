import { useEffect, useRef, useState } from "react";
import { fetchCongressTrades } from "@/lib/api/congress-client";

const CONGRESS_POLL_MS = 60_000;
const LS_KEY = "pulse_last_seen_congress_at";

export function useCongressTrades(pathname: string) {
  const [badgeCount, setBadgeCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pathname === "/hot") {
      localStorage.setItem(LS_KEY, String(Date.now()));
      setBadgeCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    const compute = async () => {
      // Shares the coalesced recent-feed request with the other congress hooks.
      const trades = await fetchCongressTrades();
      const lastSeen = Number(localStorage.getItem(LS_KEY) ?? "0");
      // "New" = newly disclosed/ingested since the user last opened the Hot tab.
      // ingestedAt (when our pipeline first stored the filing) is the right signal:
      // trade/filed dates can be old even for a brand-new disclosure.
      const unseen = trades.filter((trade) => (trade.ingestedAt ?? 0) * 1000 > lastSeen).length;
      setBadgeCount(unseen);
    };

    compute();
    intervalRef.current = setInterval(compute, CONGRESS_POLL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return badgeCount;
}
