"use client";

import DesktopDashboard from "@/components/layout/DesktopDashboard";
import MobileDashboard from "@/components/mobile/MobileDashboard";
import { useDashboardData } from "@/hooks/useDashboardData";

export default function Dashboard() {
  const {
    positions,
    proposedPositionData,
    proposedEntries,
    proposedTickers,
    addProposedPosition,
    removeProposedPosition,
    news,
    congressTrades,
    loadingNews,
    refreshing,
    lastUpdated,
    cashBalance,
    totalGainLoss,
    agentState,
    predictions,
    analyzingTickers,
    analyzeTicker,
    refresh,
  } = useDashboardData();

  return (
    <>
      <div className="hidden md:block">
        <DesktopDashboard
          positions={positions}
          proposedPositionData={proposedPositionData}
          proposedEntries={proposedEntries}
          proposedTickers={proposedTickers}
          onAddProposed={addProposedPosition}
          onRemoveProposed={removeProposedPosition}
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
          analyzingTickers={analyzingTickers}
          analyzeTicker={analyzeTicker}
        />
      </div>
      <div className="block md:hidden">
        <MobileDashboard
          positions={positions}
          proposedPositionData={proposedPositionData}
          proposedEntries={proposedEntries}
          proposedTickers={proposedTickers}
          onAddProposed={addProposedPosition}
          onRemoveProposed={removeProposedPosition}
          news={news}
          loadingNews={loadingNews}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      </div>
    </>
  );
}