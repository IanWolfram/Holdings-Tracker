"use client";

import AccountSummary from "@/components/layout/AccountSummary";
import ConnectionControls from "@/components/layout/ConnectionControls";
import TopBarDivider from "@/components/layout/TopBarDivider";
import TopBarNavItem from "@/components/layout/TopBarNavItem";
import { useCalibrationStatus } from "@/hooks/useCalibrationStatus";
import { useCongressTrades } from "@/hooks/useCongressTrades";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import {
  MARKET_STATE_DOT,
  MARKET_STATE_LABEL,
} from "@/lib/marketHours";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function SearchParamsWatcher({
  pathname,
  setSuccessVisible,
}: {
  pathname: string;
  setSuccessVisible: (v: boolean) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (!searchParams?.get("etrade_success")) return;
    setSuccessVisible(true);
    const timer = setTimeout(() => {
      setSuccessVisible(false);
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete("etrade_success");
      router.replace(`${pathname}?${newParams.toString()}`);
    }, 5000);
    return () => clearTimeout(timer);
  }, [searchParams, pathname, router, setSuccessVisible]);
  return null;
}

interface Props {
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
  totalValue?: number;
  totalCostBasis?: number;
  totalGainLoss?: number;
  _cashBalance?: number;
}

export default function TopBar({
  lastUpdated,
  refreshing,
  onRefresh,
  totalValue,
  totalCostBasis,
  totalGainLoss,
  _cashBalance,
}: Props) {
  const totalPctChange =
    totalValue !== undefined && totalCostBasis !== undefined && totalCostBasis > 0
      ? ((totalValue - totalCostBasis) / totalCostBasis) * 100
      : undefined;
  const pathname = usePathname() ?? "/";
  const [successVisible, setSuccessVisible] = useState(false);

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  const badgeCount = useCongressTrades(pathname);
  const market = useMarketStatus();
  const calibration = useCalibrationStatus();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const isTerminal = pathname === "/terminal" || pathname === "/";
  const isWorld = pathname === "/world";
  const isHot = pathname === "/hot";
  const isAgent = pathname === "/agent";

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/etrade/status");
      if (res.ok) {
        const data = await res.json();
        setIsConnected(data.connected);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll every 30 seconds to detect token expiration
    const id = setInterval(checkStatus, 30000);
    return () => clearInterval(id);
  }, []);

  // Poll status more frequently while connecting
  useEffect(() => {
    if (isConnecting) {
      const id = setInterval(checkStatus, 2000);
      return () => clearInterval(id);
    }
  }, [isConnecting]);

  return (
    <header className="bg-[#1e2023] border-b border-white/5 sticky top-0 z-50">
      <Suspense fallback={null}>
        <SearchParamsWatcher pathname={pathname} setSuccessVisible={setSuccessVisible} />
      </Suspense>
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
            <TopBarNavItem href="/terminal" icon="dashboard" label="Terminal" active={isTerminal} />
            <TopBarNavItem href="/world" icon="public" label="World" active={isWorld} />
            <TopBarNavItem
              href="/hot"
              icon="local_fire_department"
              label="Hot"
              active={isHot}
              badge={badgeCount}
            />
            <TopBarNavItem href="/agent" icon="neurology" label="Agent" active={isAgent} />
          </nav>
        </div>

        {/* ── Account Summary ── */}
        {totalValue !== undefined && (
          <AccountSummary
            totalValue={totalValue}
            totalPctChange={totalPctChange}
            totalGainLoss={totalGainLoss}
          />
        )}

        {/* ── Segmented market cluster ── */}
        <div className="flex items-center rounded-md overflow-hidden bg-white/[0.03] border border-white/[0.07] h-14">
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

          <TopBarDivider />

          {/* Countdown */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5">
            <span className="font-mono text-[10px] text-slate-400" suppressHydrationWarning>{market.verb}</span>
            <span className="font-mono text-[11px] font-bold text-white" suppressHydrationWarning>{market.countdown}</span>
          </div>

          <ConnectionControls
            successVisible={successVisible}
            isConnected={isConnected}
            isConnecting={isConnecting}
            setIsConnecting={setIsConnecting}
            timeStr={timeStr}
            onRefresh={onRefresh}
            refreshing={refreshing}
            calibratedAt={calibration.updatedAt}
            calibrationResolved={calibration.totalResolved}
          />
        </div>
      </div>
    </header>
  );
}
