"use client";

import TopBar from "@/components/TopBar";
import PositionCard from "@/components/PositionCard";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";

import EmptyState from "@/components/EmptyState";

interface DesktopDashboardProps {
  positions: Position[];
  news: Record<string, ClassifiedStory[]>;
  congressTrades: Record<string, CongressTrade[]>;
  loadingNews: Record<string, boolean>;
  refreshing: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  totalValue?: number;
  totalGainLoss?: number;
  cashBalance?: number;
}

export default function DesktopDashboard({
  positions,
  news,
  congressTrades,
  loadingNews,
  refreshing,
  lastUpdated,
  onRefresh,
  totalValue,
  totalGainLoss,
  cashBalance,
}: DesktopDashboardProps) {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopBar lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={onRefresh} totalValue={totalValue} totalGainLoss={totalGainLoss} cashBalance={cashBalance} />
      <main className="p-6 space-y-8">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {positions.map((pos) => (
            <PositionCard
              key={pos.ticker}
              position={pos}
              stories={news[pos.ticker] ?? []}
              congressTrades={congressTrades[pos.ticker] ?? []}
              loading={loadingNews[pos.ticker] ?? false}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
