"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CongressTrade } from "@/types/news.types";
import {
  getMarketStatus,
  MARKET_STATE_LABEL,
  MARKET_STATE_DOT,
  type MarketStatus,
} from "@/lib/marketHours";

const CONGRESS_POLL_MS = 60_000;
const MARKET_TICK_MS = 30_000;
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
  const [market, setMarket] = useState<MarketStatus>(() => getMarketStatus());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hot-page badge clear
  useEffect(() => {
    if (pathname === "/hot") {
      localStorage.setItem(LS_KEY, String(Date.now()));
      setBadgeCount(0);
    }
  }, [pathname]);

  // Poll congress for unseen count
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
        /* ignore */
      }
    };
    compute();
    intervalRef.current = setInterval(compute, CONGRESS_POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Tick market status every 30s
  useEffect(() => {
    const tick = () => setMarket(getMarketStatus());
    const id = setInterval(tick, MARKET_TICK_MS);
    return () => clearInterval(id);
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
            <NavItem href="/terminal" icon="dashboard" label="Terminal" active={isTerminal} />
            <NavItem href="/world" icon="public" label="World" active={isWorld} />
            <NavItem
              href="/hot"
              icon="local_fire_department"
              label="Hot"
              active={isHot}
              badge={badgeCount}
            />
          </nav>
        </div>

        {/* ── Segmented market cluster ── */}
        <div className="flex items-center rounded-md overflow-hidden bg-white/[0.03] border border-white/[0.07]">
          {/* State */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${MARKET_STATE_DOT[market.state]} ${
                market.state === "open" ? "animate-pulse shadow-[0_0_8px_var(--color-positive)]" : ""
              }`}
            />
            <span className="font-mono text-[11px] font-bold text-white tracking-[0.04em]">
              {refreshing ? "REFRESHING…" : MARKET_STATE_LABEL[market.state]}
            </span>
          </div>

          <Divider />

          {/* Countdown */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5">
            <span className="font-mono text-[10px] text-slate-400">{market.verb}</span>
            <span className="font-mono text-[11px] font-bold text-white">{market.countdown}</span>
          </div>

          <div className="hidden md:block">
            <Divider />
          </div>

          {/* Sync + refresh */}
          <div className="flex items-center gap-1.5 px-3 py-1.5">
            <span className="font-mono text-[10px] text-slate-400 hidden sm:inline">synced</span>
            {timeStr && (
              <span className="font-mono text-[11px] font-medium text-slate-200">{timeStr}</span>
            )}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="ml-1 text-positive hover:text-white disabled:opacity-40 disabled:text-slate-500 transition-colors active:scale-95 duration-100 inline-flex"
              title="Refresh"
              aria-label="Refresh"
            >
              <span
                className={`material-symbols-outlined text-[14px] ${
                  refreshing ? "animate-spin" : ""
                }`}
              >
                refresh
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ── Internals ── */

function Divider() {
  return <div className="w-px h-4 bg-white/[0.08]" />;
}

interface NavItemProps {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
}

function NavItem({ href, icon, label, active, badge }: NavItemProps) {
  return (
    <a
      href={href}
      className={`px-4 h-full flex items-center gap-2 transition-all border-b-2 relative ${
        active
          ? "text-white border-white"
          : "text-slate-400 border-transparent hover:text-slate-200"
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      <span
        className={`font-['Inter'] text-[13px] ${active ? "font-semibold" : "font-medium"}`}
      >
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-3 right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black px-1 leading-none animate-pulse">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </a>
  );
}
