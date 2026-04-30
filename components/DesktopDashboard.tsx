"use client";

import { useMemo } from "react";
import TopBar from "@/components/TopBar";
import PositionCard from "@/components/PositionCard";
import AddProposedCard from "@/components/AddProposedCard";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";
import type { AgentProgress } from "@/lib/agent/service";
import type { TickerPrediction } from "@/types/predictions";
import type { ProposedPositionEntry } from "@/hooks/useProposedPositions";
import EmptyState from "@/components/EmptyState";

interface DesktopDashboardProps {
  positions: Position[];
  proposedPositionData: Position[];
  proposedEntries: ProposedPositionEntry[];
  proposedTickers: string[];
  onAddProposed: (ticker: string, targetShares?: number, targetPrice?: number) => boolean;
  onRemoveProposed: (ticker: string) => void;
  news: Record<string, ClassifiedStory[]>;
  congressTrades: Record<string, CongressTrade[]>;
  loadingNews: Record<string, boolean>;
  refreshing: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  agentState?: AgentProgress;
  totalValue?: number;
  totalCostBasis?: number;
  totalGainLoss?: number;
  cashBalance?: number;
  predictions?: Record<string, TickerPrediction[]>;
}

export default function DesktopDashboard({
  positions,
  proposedPositionData,
  proposedEntries,
  proposedTickers,
  onAddProposed,
  onRemoveProposed,
  news,
  congressTrades,
  loadingNews,
  refreshing,
  lastUpdated,
  onRefresh,
  agentState,
  totalValue,
  totalCostBasis,
  totalGainLoss,
  cashBalance,
  predictions = {},
}: DesktopDashboardProps) {
  const predictionsByTicker = useMemo(() => {
    const out: Record<string, {
      current: TickerPrediction | null;
      all: TickerPrediction[];
      resolvedStats: { total: number; correct: number };
    }> = {};
    for (const [ticker, preds] of Object.entries(predictions)) {
      const sorted = [...preds].sort((a, b) => b.runAt - a.runAt);
      const current = sorted.find((p) => p.status === "pending") ?? null;
      const resolved = preds.filter((p) => p.status === "resolved");
      out[ticker] = {
        current,
        all: sorted,
        resolvedStats: {
          total: resolved.length,
          correct: resolved.filter((p) => p.outcome === "CORRECT").length,
        },
      };
    }
    return out;
  }, [predictions]);

  // Merge held + proposed positions
  const allPositions = useMemo(() => {
    const heldTickers = new Set(positions.map((p) => p.ticker));
    const filteredProposed = proposedPositionData.filter(
      (p) => !heldTickers.has(p.ticker)
    );
    return [...positions, ...filteredProposed];
  }, [positions, proposedPositionData]);

  // All tickers for deduplication check
  const allTickers = useMemo(
    () => allPositions.map((p) => p.ticker),
    [allPositions]
  );

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopBar lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={onRefresh} totalValue={totalValue} totalCostBasis={totalCostBasis} totalGainLoss={totalGainLoss} _cashBalance={cashBalance} />
      <main className="p-4 space-y-6">
        {positions.length === 0 && !refreshing && (
          <EmptyState
            icon="candlestick_chart"
            headline="No positions loaded"
            sub="Check your E*TRADE connection or retry below"
            variant="neutral"
            className="h-64"
            cta={{
              label: "Retry",
              onClick: onRefresh
            }}
          />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {allPositions.map((pos) => (
            <PositionCard
              key={pos.ticker}
              position={pos}
              stories={news[pos.ticker] ?? []}
              congressTrades={congressTrades[pos.ticker] ?? []}
              loading={loadingNews[pos.ticker] ?? false}
              agentState={agentState}
              prediction={predictionsByTicker[pos.ticker]?.current}
              allPredictions={predictionsByTicker[pos.ticker]?.all}
              resolvedStats={predictionsByTicker[pos.ticker]?.resolvedStats}
              onRemoveProposed={pos.isProposed ? onRemoveProposed : undefined}
            />
          ))}
          <AddProposedCard
            onAdd={onAddProposed}
            existingTickers={allTickers}
          />
        </div>
      </main>
    </div>
  );
}