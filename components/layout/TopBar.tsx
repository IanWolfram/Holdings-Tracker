"use client";

import AccountIconDiv from "@/components/layout/AccountIconDiv";
import AccountPanel from "@/components/layout/AccountPanel";
import AccountSummary from "@/components/layout/AccountSummary";
import ConnectionControls from "@/components/layout/ConnectionControls";
import TopBarNavItem from "@/components/layout/TopBarNavItem";
import AgentTrigger from "@/components/triggers/AgentTrigger";
import { useCalibrationStatus } from "@/hooks/useCalibrationStatus";
import { useCongressTrades } from "@/hooks/useCongressTrades";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import {
  MARKET_STATE_DOT,
  MARKET_STATE_LABEL,
} from "@/lib/marketHours";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";

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
    }, 5_000);
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
  lastUpdated: _lastUpdated,
  refreshing,
  onRefresh: _onRefresh,
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

  const badgeCount = useCongressTrades(pathname);
  const market = useMarketStatus();
  const calibration = useCalibrationStatus();

  // Live clock, ticking to the second, shown under the market state.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const nowStr = now
    ? now.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "";
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);

  const closeAccountPanel = useCallback(() => setAccountPanelOpen(false), []);
  const openAccountPanel = useCallback(() => setAccountPanelOpen(true), []);

  const isTerminal = pathname === "/terminal" || pathname === "/";
  const isWorld = pathname === "/world";
  const isHot = pathname === "/hot";
  const isAgent = pathname === "/agent";

  const checkStatus = async () => {
    try {
      const res = await authedFetch("/api/etrade/status");
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
    const id = setInterval(checkStatus, 30_000);
    return () => clearInterval(id);
  }, []);

  // Poll status more frequently while connecting
  useEffect(() => {
    if (isConnecting) {
      const id = setInterval(checkStatus, 2_000);
      return () => clearInterval(id);
    }
  }, [isConnecting]);

  return (
    <>
    <header className="nav-shell sticky top-0 z-50 h-[68px]">
      <Suspense fallback={null}>
        <SearchParamsWatcher pathname={pathname} setSuccessVisible={setSuccessVisible} />
      </Suspense>
      <div className="flex justify-between items-center w-full h-full px-5">
        {/* Brand + Nav */}
        <div className="flex items-center gap-9 h-full">
          <div className="flex flex-col justify-center">
            <h1 className="font-['Space_Grotesk'] font-bold text-white text-[21px] leading-none tracking-[-0.02em]">
              Pulse
            </h1>
            <p className="font-mono text-ink-dimmer text-[9px] font-medium uppercase tracking-[0.26em] mt-[3px]">
              Precision Ledger
            </p>
          </div>
          <nav className="flex h-full items-stretch" aria-label="Primary">
            <TopBarNavItem href="/terminal" icon="dashboard" label="Terminal" active={isTerminal} accent="green" />
            <TopBarNavItem href="/world" icon="public" label="World" active={isWorld} accent="blue" />
            <TopBarNavItem
              href="/hot"
              icon="local_fire_department"
              label="Hot"
              active={isHot}
              badge={badgeCount}
              accent="red"
            />
            <TopBarNavItem href="/agent" icon="neurology" label="Agent" active={isAgent} accent="orange" />
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

        {/* ── Unified status rail ── */}
        <div className="nav-rail flex items-stretch h-full rounded-[14px] overflow-hidden border border-white/10">
          {/* agent sweep — base layer */}
          <AgentTrigger />

          {/* market status + live clock */}
          <div className="relative z-10 -ml-3 flex flex-col justify-center gap-0.75 pl-3.5 pr-5 rounded-l-[14px] border-l border-white/10 bg-[#131316]">
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${MARKET_STATE_DOT[market.state]} ${
                  market.state === "open" ? "animate-pulse shadow-[0_0_8px_var(--color-positive)]" : ""
                }`}
              />
              <span className="font-mono text-[10.5px] font-bold text-white tracking-[0.04em] uppercase">
                {refreshing ? "REFRESHING…" : MARKET_STATE_LABEL[market.state]}
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-400 tabular-nums tracking-tight" suppressHydrationWarning>
              {nowStr}
            </span>
          </div>

          {/* broker connection */}
          <div className="relative z-20 -ml-3 flex items-stretch rounded-l-[14px] border-l border-white/10 bg-[#131316] overflow-hidden">
            <ConnectionControls
              successVisible={successVisible}
              isConnected={isConnected}
              isConnecting={isConnecting}
              setIsConnecting={setIsConnecting}
            />
          </div>

          {/* settings / account orbit */}
          <div className="relative z-30 -ml-3 flex items-stretch rounded-l-[14px] border-l border-white/10 bg-[#3a3a40] overflow-hidden">
            <AccountIconDiv onClick={openAccountPanel} isOpen={accountPanelOpen} />
          </div>
        </div>
      </div>

    </header>

    <AnimatePresence>
      {accountPanelOpen && (
        <>
          <motion.div
            key="account-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 55,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
            onClick={closeAccountPanel}
          />
          <AccountPanel
            key="account-panel"
            onClose={closeAccountPanel}
            isConnected={isConnected}
            isConnecting={isConnecting}
          />
        </>
      )}
    </AnimatePresence>
    </>
  );
}
