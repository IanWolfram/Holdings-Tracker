"use client";

import DesktopDashboard from "@/components/DesktopDashboard";
import MobileDashboard from "@/components/mobile/MobileDashboard";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function Dashboard() {
  const {
    positions,
    news,
    congressTrades,
    loadingNews,
    refreshing,
    lastUpdated,
    cashBalance,
    totalGainLoss,
    agentState,
    predictions,
    refresh,
  } = useDashboardData();

  return (
    <>
      <div className="hidden md:block">
        <DesktopDashboard
          positions={positions}
          news={news}
          congressTrades={congressTrades}
          loadingNews={loadingNews}
          refreshing={refreshing}
          lastUpdated={lastUpdated}
          onRefresh={refresh}
          agentState={agentState}
          totalValue={positions.length > 0 ? positions.reduce((sum, p) => sum + p.marketValue, 0) : undefined}
          totalCostBasis={positions.length > 0 ? positions.reduce((sum, p) => sum + p.pricePaid * p.quantity, 0) : undefined}
          totalGainLoss={totalGainLoss}
          cashBalance={cashBalance}
          predictions={predictions}
        />
      </div>
      <div className="block md:hidden">
        <MobileDashboard
          positions={positions}
          news={news}
          loadingNews={loadingNews}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      </div>
    </>
  );
}
