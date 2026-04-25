import React from "react";
import { motion } from "framer-motion";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";
import type { AgentProgress } from "@/lib/agent/service";
import NewsCard from "@/components/NewsCard";
import PendingNewsCard from "@/components/PendingNewsCard";
import CongressTradeCard from "@/components/CongressTradeCard";
import NewsCollapsible from "@/components/NewsCollapsible";
import EmptyState from "@/components/EmptyState";
import SourceBadge from "@/components/positions/SourceBadge";
import CongressHeader from "@/components/positions/CongressHeader";
import GlassContainer from "@/components/ui/LiquidGlass/GlassContainer";
import PredictionStrip from "@/components/positions/PredictionStrip";
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
  resolvedStats?: { total: number; correct: number };
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
  prediction,
  resolvedStats,
}: PositionCardNewsFeedProps) {
  return (
    <>
      <PredictionStrip
        prediction={prediction ?? null}
        resolvedCount={resolvedStats?.total ?? 0}
        correctCount={resolvedStats?.correct ?? 0}
      />
    <GlassContainer className="flex-1 p-3 border-t border-white/[0.05]">
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
        <div className="space-y-3">
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
              defaultExpanded
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
            <NewsCollapsible
              badge={<CongressHeader />}
              count={congressTrades.length}
              defaultExpanded={congressTrades.length === 1}
            >
              {congressTrades.map((trade) => (
                <CongressTradeCard key={trade.id} trade={trade} />
              ))}
            </NewsCollapsible>
          )}

          {sourceOrder.filter((source) => storyGroups[source]?.length).map((source) => {
            const group = storyGroups[source];
            return (
              <NewsCollapsible
                key={source}
                badge={<SourceBadge source={source} />}
                count={group.length}
              >
                {group.map((story) => (
                  <NewsCard
                    key={`${story.ticker}-${story.source}-${story.datetime}-${story.url}`}
                    story={story}
                  />
                ))}
              </NewsCollapsible>
            );
          })}

          {Object.keys(storyGroups)
            .filter((source) => sourcePriority[source] === undefined)
            .map((source) => {
              const group = storyGroups[source];
              return (
                <NewsCollapsible
                  key={source}
                  badge={<SourceBadge source={source} />}
                  count={group.length}
                >
                  {group.map((story) => (
                    <NewsCard
                      key={`${story.ticker}-${story.source}-${story.datetime}-${story.url}`}
                      story={story}
                    />
                  ))}
                </NewsCollapsible>
              );
            })}
        </div>
      )}
    </GlassContainer>
    </>
  );
}
