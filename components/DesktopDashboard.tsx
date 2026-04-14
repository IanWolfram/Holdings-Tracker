"use client";

import TopBar from "@/components/TopBar";
import PositionCard from "@/components/PositionCard";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";

interface DesktopDashboardProps {
  positions: Position[];
  news: Record<string, ClassifiedStory[]>;
  congressTrades: Record<string, CongressTrade[]>;
  loadingNews: Record<string, boolean>;
  refreshing: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export default function DesktopDashboard({
  positions,
  news,
  congressTrades,
  loadingNews,
  refreshing,
  lastUpdated,
  onRefresh,
}: DesktopDashboardProps) {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopBar lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={onRefresh} />
      <main className="p-6 space-y-8">
        {positions.length === 0 && !refreshing && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-700">candlestick_chart</span>
            <p className="text-sm text-slate-500">No positions loaded.</p>
            <button
              onClick={onRefresh}
              className="text-[10px] uppercase tracking-widest text-slate-400 border border-white/10 px-3 py-1 rounded-sm hover:bg-white/5 transition-colors"
            >
              Retry
            </button>
          </div>
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
