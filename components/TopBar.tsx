"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CongressTrade } from "@/types/news.types";

const CONGRESS_POLL_MS = 60_000; // 1 minute
const LS_KEY = "pulse_last_seen_congress_at";

interface Props {
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function TopBar({ lastUpdated, refreshing, onRefresh }: Props) {
  const pathname = usePathname();
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  const [badgeCount, setBadgeCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // When on the hot page, clear the badge and record last-seen timestamp
  useEffect(() => {
    if (pathname === "/hot") {
      localStorage.setItem(LS_KEY, String(Date.now()));
      setBadgeCount(0);
    }
  }, [pathname]);

  // Poll /api/congress and compute unseen count
  useEffect(() => {
    const compute = async () => {
      try {
        const res = await fetch("/api/congress");
        if (!res.ok) return;
        const { trades }: { trades: CongressTrade[] } = await res.json();
        const lastSeen = Number(localStorage.getItem(LS_KEY) ?? "0");
        const unseen = trades.filter((t) => t.tradeDate * 1000 > lastSeen).length;
        setBadgeCount(unseen);
      } catch {
        // ignore
      }
    };

    compute();
    intervalRef.current = setInterval(compute, CONGRESS_POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const isTerminal = pathname === "/terminal" || pathname === "/";
  const isWorld = pathname === "/world";
  const isHot = pathname === "/hot";

  return (
    <header className="bg-[#1e2023] border-b border-white/5 sticky top-0 z-50">
      <div className="flex justify-between items-center w-full px-6 py-0">
        {/* Brand + Nav */}
        <div className="flex items-center gap-12">
          <div className="py-4">
            <h1 className="font-['Space_Grotesk'] font-black text-white text-xl leading-none">
              Pulse
            </h1>
            <p className="text-slate-500 text-[9px] uppercase tracking-widest mt-0.5">
              Precision Ledger
            </p>
          </div>
          <nav className="flex h-16 items-center">
            <a
              href="/terminal"
              className={`px-4 h-full flex items-center gap-2 transition-all border-b-2 ${
                isTerminal
                  ? "text-white border-white"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">dashboard</span>
              <span className={`font-['Inter'] text-[13px] ${isTerminal ? "font-semibold" : "font-medium"}`}>Terminal</span>
            </a>
            <a
              href="/world"
              className={`px-4 h-full flex items-center gap-2 transition-all border-b-2 ${
                isWorld
                  ? "text-white border-white"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">public</span>
              <span className={`font-['Inter'] text-[13px] ${isWorld ? "font-semibold" : "font-medium"}`}>World</span>
            </a>
            <a
              href="/hot"
              className={`px-4 h-full flex items-center gap-2 transition-all border-b-2 relative ${
                isHot
                  ? "text-white border-white"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">local_fire_department</span>
              <span className={`font-['Inter'] text-[13px] ${isHot ? "font-semibold" : "font-medium"}`}>Hot</span>
              {badgeCount > 0 && (
                <span className="absolute top-3 right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black px-1 leading-none animate-pulse">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </a>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-6">
          {/* Market status */}
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded">
            <div
              className={`w-2 h-2 rounded-full ${
                refreshing ? "bg-blue-400 animate-pulse" : "bg-slate-300 animate-pulse"
              }`}
            />
            <span className="font-['Space_Grotesk'] text-xs tracking-tight font-medium text-slate-300 uppercase">
              {refreshing ? "Refreshing…" : "Market Open"}
            </span>
          </div>

          {/* Timestamp + refresh */}
          <div className="hidden sm:flex items-center gap-3">
            {timeStr && (
              <span className="text-slate-500 font-mono text-[10px]">{timeStr}</span>
            )}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="text-slate-400 hover:bg-white/5 p-1.5 rounded transition-colors active:scale-95 duration-100 disabled:opacity-40"
              title="Refresh"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
