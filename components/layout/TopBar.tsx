"use client";

import AccountIconDiv from "@/components/layout/AccountIconDiv";
import AgentSignalBubble from "@/components/layout/AgentSignalBubble";
import AccountPanel from "@/components/layout/AccountPanel";
import AccountSummary from "@/components/layout/AccountSummary";
import ConnectionControls from "@/components/layout/ConnectionControls";
import TopBarNavItem from "@/components/layout/TopBarNavItem";
import { useCalibrationStatus } from "@/hooks/useCalibrationStatus";
import { useCongressTrades } from "@/hooks/useCongressTrades";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import {
  MARKET_STATE_DOT,
  MARKET_STATE_LABEL,
} from "@/lib/marketHours";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";

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
  // Connection state reflects the user's linked brokerage (via SnapTrade): the
  // rail shows that brokerage's logo + brand gradient, not SnapTrade's branding.
  const [broker, setBroker] = useState<{
    connected: boolean;
    slug: string | null;
    name: string | null;
    logo: string | null;
  }>({ connected: false, slug: null, name: null, logo: null });
  const isConnected = broker.connected;
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);

  const closeAccountPanel = useCallback(() => setAccountPanelOpen(false), []);
  const openAccountPanel = useCallback(() => setAccountPanelOpen(true), []);

  const isTerminal = pathname === "/terminal" || pathname === "/";
  const isWorld = pathname === "/world";
  const isHot = pathname === "/hot";
  const isAgent = pathname === "/agent";

  // Connection state now reflects SnapTrade auth (brokerage linking moved from
  // E*TRADE OAuth to SnapTrade), so the rail's "connected" gradient lights up
  // when the user has at least one live SnapTrade connection.
  const checkStatus = async () => {
    try {
      const res = await authedFetch("/api/snaptrade/status");
      if (res.ok) {
        const data = await res.json();
        const conns: Array<{
          name?: string | null;
          slug?: string | null;
          logo?: string | null;
          disabled?: boolean;
        }> = data.connections ?? [];
        // Surface the primary brokerage — prefer an active (non-disabled) one.
        const primary = conns.find((c) => !c.disabled) ?? conns[0] ?? null;
        setBroker({
          connected: !!data.connected,
          slug: primary?.slug ?? null,
          name: primary?.name ?? null,
          logo: primary?.logo ?? null,
        });
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll every 30 seconds to detect connection changes
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
          {/* Agent signal bubble — hugs the Agent tab, sits before the account total */}
          <AgentSignalBubble />
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
          {/* market status + live clock */}
          <div className="relative z-10 flex flex-col justify-center gap-0.75 pl-3.5 pr-5 rounded-l-[14px] bg-[#131316]">
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
              isConnected={isConnected}
              isConnecting={isConnecting}
              setIsConnecting={setIsConnecting}
              brokerSlug={broker.slug}
              brokerName={broker.name}
              brokerLogo={broker.logo}
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
