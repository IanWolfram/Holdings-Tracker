"use client";

import React from "react";
import MobileHeader from "./MobileHeader";
import MobileBottomNav from "./MobileBottomNav";
import MobilePositionCard from "./MobilePositionCard";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory } from "@/types/news.types";

interface MobileDashboardProps {
  positions: Position[];
  news: Record<string, ClassifiedStory[]>;
  loadingNews: Record<string, boolean>;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function MobileDashboard({
  positions,
  news,
  loadingNews: _loadingNews,
  refreshing,
  onRefresh,
}: MobileDashboardProps) {
  return (
    <div className="bg-transparent text-on-surface font-body selection:bg-positive/30 min-h-screen">
      <MobileHeader onRefresh={onRefresh} />
      
      <main className="pt-20 pb-24 px-3 space-y-5">
        {/* Market Status */}
        <div className="flex justify-between items-end px-1 mb-2">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Market Protocol</p>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight">
              PULSE: {refreshing ? "SYNCING..." : "ACTIVE"}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-widest text-positive font-bold">Latency</p>
            <p className="font-mono text-xs font-bold text-white">14ms</p>
          </div>
        </div>

        <div className="space-y-6">
          {positions.length === 0 && !refreshing && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center opacity-50">
              <span className="material-symbols-outlined text-4xl">inventory_2</span>
              <p className="text-[10px] uppercase font-bold tracking-widest">No positions detected</p>
            </div>
          )}

          {positions.map((pos) => (
            <MobilePositionCard 
              key={pos.ticker} 
              position={pos} 
              stories={news[pos.ticker] ?? []} 
            />
          ))}
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
