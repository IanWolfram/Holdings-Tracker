"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import TopBar from "@/components/layout/TopBar";
import PositionCard from "@/components/cards/PositionCard";
import AddProposedCard from "@/components/cards/AddProposedCard";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";
import type { AgentProgress } from "@/lib/agent/service";
import type { TickerPrediction } from "@/types/predictions";
import type { ProposedPositionEntry } from "@/hooks/useProposedPositions";
import EmptyState from "@/components/layout/EmptyState";

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
  analyzingTickers?: Set<string>;
  analyzeTicker?: (ticker: string) => void;
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
  analyzingTickers,
  analyzeTicker,
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

  // Index of the first proposed card in the merged grid (held positions come
  // first, so it sits at positions.length). -1 when there's nothing to divide
  // (no held positions, or no proposed positions).
  const firstProposedIndex =
    positions.length > 0 && allPositions.length > positions.length
      ? positions.length
      : -1;

  // Vertical divider between the last real position and the first proposed one.
  // We measure the live grid so the line only appears when the first proposed
  // card is mid-row — if it wraps to the start of a new row, there's nothing to
  // divide and we hide it. Geometry is relative to the (position: relative) grid.
  const gridRef = useRef<HTMLDivElement>(null);
  const [divider, setDivider] = useState<{ left: number; top: number; height: number } | null>(null);

  useEffect(() => {
    if (firstProposedIndex < 0) {
      setDivider(null);
      return;
    }
    const grid = gridRef.current;
    if (!grid) return;

    const measure = () => {
      // The card elements are the grid children at [0..allPositions.length-1];
      // the AddProposedCard and this divider span come after, so these indices
      // stay stable.
      const prev = grid.children[firstProposedIndex - 1] as HTMLElement | undefined;
      const card = grid.children[firstProposedIndex] as HTMLElement | undefined;
      if (!prev || !card) {
        setDivider(null);
        return;
      }
      // If the first proposed card sits on a different row than the last held
      // card, the proposed run starts a new line — no divider.
      if (Math.abs(prev.offsetTop - card.offsetTop) > 2) {
        setDivider(null);
        return;
      }
      const GAP = 16; // matches gap-4
      const top = Math.min(prev.offsetTop, card.offsetTop);
      const bottom = Math.max(
        prev.offsetTop + prev.offsetHeight,
        card.offsetTop + card.offsetHeight
      );
      setDivider({
        left: card.offsetLeft - GAP / 2,
        top,
        height: bottom - top,
      });
    };

    // rAF so the grid has settled its layout before the first read.
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [firstProposedIndex, allPositions.length, news, loadingNews]);

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
        <div
          ref={gridRef}
          className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-stretch"
        >
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
              onAnalyzeTicker={analyzeTicker ? () => analyzeTicker(pos.ticker) : undefined}
              isTickerAnalyzing={analyzingTickers?.has(pos.ticker) ?? false}
            />
          ))}
          <AddProposedCard
            onAdd={onAddProposed}
            existingTickers={allTickers}
          />
          {divider && (
            <span
              aria-hidden
              className="pointer-events-none absolute z-20"
              style={{
                left: divider.left - 1,
                top: divider.top,
                width: 2,
                height: divider.height,
                borderRadius: 2,
                background:
                  "linear-gradient(180deg, transparent 0%, rgba(234,179,8,0.7) 14%, rgba(234,179,8,0.7) 86%, transparent 100%)",
                boxShadow: "0 0 6px rgba(234,179,8,0.3)",
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}