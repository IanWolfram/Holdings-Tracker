import { useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import type { CongressTrade } from "@/types/news.types";

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
      try {
        const res = await authedFetch("/api/congress");
        if (!res.ok) return;
        const { trades }: { trades: CongressTrade[] } = await res.json();
        const lastSeen = Number(localStorage.getItem(LS_KEY) ?? "0");
        const unseen = trades.filter((trade) => trade.tradeDate * 1000 > lastSeen).length;
        setBadgeCount(unseen);
      } catch {
        // ignore
      }
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
