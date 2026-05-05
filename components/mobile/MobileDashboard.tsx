"use client";

import React, { useMemo } from "react";
import MobileHeader from "./MobileHeader";
import MobileBottomNav from "./MobileBottomNav";
import MobilePositionCard from "./MobilePositionCard";
import AddProposedCard from "@/components/cards/AddProposedCard";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory } from "@/types/news.types";
import type { ProposedPositionEntry } from "@/hooks/useProposedPositions";

import EmptyState from "@/components/layout/EmptyState";

interface MobileDashboardProps {
  positions: Position[];
  proposedPositionData: Position[];
  proposedEntries: ProposedPositionEntry[];
  proposedTickers: string[];
  onAddProposed: (ticker: string, targetShares?: number, targetPrice?: number) => boolean;
  onRemoveProposed: (ticker: string) => void;
  news: Record<string, ClassifiedStory[]>;
  loadingNews: Record<string, boolean>;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function MobileDashboard({
  positions,
  proposedPositionData,
  proposedEntries,
  proposedTickers,
  onAddProposed,
  onRemoveProposed,
  news,
  loadingNews: _loadingNews,
  refreshing,
  onRefresh,
}: MobileDashboardProps) {
  const allPositions = useMemo(() => {
    const heldTickers = new Set(positions.map((p) => p.ticker));
    const filteredProposed = proposedPositionData.filter(
      (p) => !heldTickers.has(p.ticker)
    );
    return [...positions, ...filteredProposed];
  }, [positions, proposedPositionData]);

  const allTickers = useMemo(
    () => allPositions.map((p) => p.ticker),
    [allPositions]
  );

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
            <EmptyState
              icon="inventory_2"
              headline="No positions detected"
              sub="Sync with broker to view fleet"
              variant="neutral"
              className="py-12"
            />
          )}

          {allPositions.map((pos) => (
            <MobilePositionCard
              key={pos.ticker}
              position={pos}
              stories={news[pos.ticker] ?? []}
            />
          ))}

          <AddProposedCard
            onAdd={onAddProposed}
            existingTickers={allTickers}
          />
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}