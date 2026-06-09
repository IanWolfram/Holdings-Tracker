import React, { useState } from "react";
import { motion } from "framer-motion";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";
import type { AgentProgress } from "@/lib/agent/service";
import NewsCard from "@/components/cards/NewsCard";
import PendingNewsCard from "@/components/cards/PendingNewsCard";
import CongressTradeCard from "@/components/cards/CongressTradeCard";
import NewsCollapsible from "@/components/news/NewsCollapsible";
import EmptyState from "@/components/layout/EmptyState";
import SourceBadge from "@/components/positions/SourceBadge";
import CongressHeader from "@/components/positions/CongressHeader";
import GlassContainer from "@/components/ui/LiquidGlass/GlassContainer";
import PredictionStrip, { PredictionPanel } from "@/components/positions/PredictionStrip";
import type { TickerPrediction } from "@/types/predictions";

interface PositionCardNewsFeedProps {
  loading: boolean;
  hasContent: boolean;
  ticker: string;
  pendingStories: ClassifiedStory[];
  congressTrades: CongressTrade[];
  storyGroups: Record<string, ClassifiedStory[]>;
  sourceOrder: readonly string[];
  sourcePriority: Record<string, number>;
  agentState?: AgentProgress;
  prediction?: TickerPrediction | null;
  allPredictions?: TickerPrediction[];
  resolvedStats?: { total: number; correct: number };
  compact?: boolean;
  currentPrice?: number;
}

export default function PositionCardNewsFeed({
  loading,
  hasContent,
  ticker,
  pendingStories,
  congressTrades,
  storyGroups,
  sourceOrder,
  sourcePriority,
  agentState,
  allPredictions,
  resolvedStats,
  compact = false,
  currentPrice = 0,
}: PositionCardNewsFeedProps) {
  const [showPredictions, setShowPredictions] = useState(false);

  // All analyzed (classified) source stories collapse into a single stack —
  // polygon first, then finnhub, then any remaining sources — rather than one
  // stack per source.
  const analyzedSources = [
    ...sourceOrder.filter((s) => storyGroups[s]?.length),
    ...Object.keys(storyGroups).filter(
      (s) => sourcePriority[s] === undefined && storyGroups[s]?.length,
    ),
  ];
  const analyzedStories = analyzedSources.flatMap((s) => storyGroups[s] ?? []);

  // A heavily-traded ticker can have 100+ congressional disclosures. Render only
  // the most recent (already sorted newest-first) to keep the DOM light — the
  // collapsed stack only previews the top card anyway.
  const MAX_CONGRESS_TRADES = 25;
  const recentCongressTrades = congressTrades.slice(0, MAX_CONGRESS_TRADES);

  return (
    <>
      <PredictionStrip
        allPredictions={allPredictions ?? []}
        correctCount={resolvedStats?.correct ?? 0}
        compact={compact}
        open={showPredictions}
        onToggle={setShowPredictions}
      />
      {/* News region — always mounted so it anchors the card height; the
          prediction panel overlays it (rather than replacing it) so toggling
          predictions never changes the card's height. */}
      <div className="relative flex-1 min-h-0">
        <div className={`h-full ${showPredictions ? "invisible" : ""}`} aria-hidden={showPredictions || undefined}>
        <GlassContainer className={`h-full ${compact ? "p-2" : "p-3"} border-t border-white/[0.05]`}>
          {/* Top-anchored feed that fills the card's fixed height: news expands
              downward (the primary/polygon group at the top grows down, pushing the
              groups below it down). The feed scrolls when content exceeds the fixed
              height, so the card's overall height stays constant. */}
          <div className="flex flex-col overflow-y-auto overflow-x-hidden h-full">
          {loading && !hasContent && (
            <EmptyState
              icon="progress_activity"
              headline="Loading feed…"
              sub={`Classifying stories for ${ticker}`}
              variant="loading"
            />
          )}

          {!loading && !hasContent && (
            <EmptyState
              icon="candlestick_chart"
              headline="No recent news"
              sub="Refresh or check back later"
              variant="neutral"
            />
          )}

          {hasContent && (
            <div className={compact ? "space-y-2" : "space-y-3"}>
              {pendingStories.length > 0 && (
                <NewsCollapsible
                  badge={
                    <span className="flex items-center gap-2">
                      <div className="relative w-2.5 h-2.5">
                        <div className="absolute inset-0 rounded-full border border-white/10" />
                        <motion.div
                          className="absolute inset-0 rounded-full border-t border-t-[#00FF88] border-r-transparent border-b-transparent border-l-transparent"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Pending
                      </span>
                    </span>
                  }
                  count={pendingStories.length}
                  stackVariant={
                    agentState?.status === "running" && agentState?.ticker === ticker
                      ? "queued"
                      : "pending"
                  }
                >
                  {pendingStories.map((story) => (
                    <PendingNewsCard
                      key={`${story.ticker}-${story.source}-${story.datetime}-${story.headline}`}
                      story={story}
                      agentState={agentState}
                    />
                  ))}
                </NewsCollapsible>
              )}

              {congressTrades.length > 0 && (
                <NewsCollapsible badge={<CongressHeader />} count={recentCongressTrades.length}>
                  {recentCongressTrades.map((trade) => (
                    <CongressTradeCard key={trade.id} trade={trade} />
                  ))}
                </NewsCollapsible>
              )}

              {analyzedStories.length > 0 && (
                <NewsCollapsible
                  badge={
                    <span className="flex items-center gap-1.5">
                      {analyzedSources.map((source) => (
                        <SourceBadge key={source} source={source} iconOnly />
                      ))}
                    </span>
                  }
                  count={analyzedStories.length}
                >
                  {analyzedStories.map((story) => (
                    <NewsCard
                      key={`${story.ticker}-${story.source}-${story.datetime}-${story.url}`}
                      story={story}
                    />
                  ))}
                </NewsCollapsible>
              )}
            </div>
          )}
          </div>
        </GlassContainer>
        </div>
        {showPredictions && (
          <div className="absolute inset-0 z-40 overflow-hidden border-t border-white/[0.05]">
            <PredictionPanel
              allPredictions={allPredictions ?? []}
              currentPrice={currentPrice}
            />
          </div>
        )}
      </div>
    </>
  );
}