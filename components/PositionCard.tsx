"use client";

import { useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import GlassView from "./ui/LiquidGlass/GlassView";
import PositionCardHeader from "./positions/PositionCardHeader";
import PositionCardNewsFeed from "./positions/PositionCardNewsFeed";
import { groupStoriesBySource } from "@/lib/utils/stories";
import { calculateSentimentMetrics } from "@/lib/utils/sentiment";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";
import type { AgentProgress } from "@/lib/agent/service";
import type { TickerPrediction } from "@/types/predictions";

const SOURCE_ORDER = ["twitter", "reddit", "finnhub", "newsapi"] as const;
const SOURCE_PRIORITY: Record<string, number> = { twitter: 0, reddit: 1, finnhub: 2, newsapi: 3 };
const POSITION_R = 12;

interface Props {
  position: Position;
  stories: ClassifiedStory[];
  congressTrades?: CongressTrade[];
  loading: boolean;
  frosted?: boolean;
  compact?: boolean;
  agentState?: AgentProgress;
  prediction?: TickerPrediction | null;
  allPredictions?: TickerPrediction[];
  resolvedStats?: { total: number; correct: number };
  onRemoveProposed?: (ticker: string) => void;
  onAnalyzeTicker?: () => void;
  isTickerAnalyzing?: boolean;
}

function glowClass(buy: number, sell: number, loading: boolean): string {
  if (loading) return "glow-neutral";
  if (buy > sell) return "glow-positive";
  if (sell > buy) return "glow-negative";
  return "glow-neutral";
}

export default function PositionCard({
  position,
  stories,
  congressTrades = [],
  loading,
  frosted,
  compact = process.env.NEXT_PUBLIC_UI_MODE === "compact",
  agentState,
  prediction,
  allPredictions,
  resolvedStats,
  onRemoveProposed,
  onAnalyzeTicker,
  isTickerAnalyzing,
}: Props) {
  const articleRef = useRef<HTMLDivElement>(null);
  const [_hovered, setHovered] = useState(false);

  const isProposed = position.isProposed === true;

  const {
    ticker,
    description,
    marketValue,
    gainLoss,
    quantity,
    currentPrice,
    pricePaid,
    history,
    purchaseDate,
    dayChange,
    dayChangePct,
    targetPrice,
    targetShares,
  } = position;

  const buy = stories.filter((s) => s.verdict === "BUY").length;
  const sell = stories.filter((s) => s.verdict === "SELL").length;
  const hold = stories.filter((s) => s.verdict === "HOLD").length;
  const sentimentMetrics = useMemo(() => calculateSentimentMetrics(stories), [stories]);
  const avgConfidence = sentimentMetrics.avgConfidence;

  const gainPositive = gainLoss >= 0;
  const gainPct = pricePaid > 0 ? ((currentPrice - pricePaid) / pricePaid) * 100 : 0;

  const todayDelta = useMemo(() => {
    if (typeof dayChangePct === "number" && dayChangePct !== 0) {
      return { diff: (dayChange ?? 0) * quantity, pct: dayChangePct };
    }
    if (!history || history.length < 2) return null;
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    if (typeof last !== "number" || typeof prev !== "number" || prev === 0) return null;
    return { diff: (last - prev) * quantity, pct: ((last - prev) / prev) * 100 };
  }, [history, quantity, dayChange, dayChangePct]);

  const effectiveGlowClass = isProposed ? "glow-proposed" : glowClass(buy, sell, loading);

  const { pendingStories, storyGroups } = useMemo(() => {
    return groupStoriesBySource(stories);
  }, [stories]);

  const hasContent = stories.length > 0 || congressTrades.length > 0;

  const scanColor = isProposed
    ? "#EAB308"
    : buy > sell
      ? "#00FF88"
      : sell > buy
        ? "#FF4444"
        : "#cbd5e1";

  return (
    <GlassView
      layout
      layoutId={ticker}
      cornerRadius={POSITION_R}
      className={`relative flex flex-col group shadow-2xl transition-all duration-300${isProposed ? " glass-edge-proposed" : ""}`}
      style={{
        backgroundColor: frosted ? "rgba(8, 13, 9, 0.92)" : "rgba(0, 0, 0, 0.6)",
        backdropFilter: frosted
          ? "blur(48px) saturate(130%) brightness(1.06) contrast(0.92)"
          : undefined,
        WebkitBackdropFilter: frosted
          ? "blur(48px) saturate(130%) brightness(1.06) contrast(0.92)"
          : undefined,
        border: frosted ? "1px solid rgba(255,255,255,0.07)" : undefined,
        overflow: "hidden",
      }}
    >
      {isProposed && onRemoveProposed && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveProposed(ticker);
          }}
          className="absolute top-2 right-2 z-30 w-5 h-5 flex items-center justify-center rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 hover:text-amber-300 transition-colors font-mono text-[10px] leading-none"
          aria-label="Remove proposed position"
        >
          x
        </button>
      )}
      <div
        ref={articleRef}
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <motion.div
          className="absolute inset-x-0 h-[2px] z-50 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${scanColor}, transparent)`,
            boxShadow: `0 0 10px ${scanColor}, 0 0 20px ${scanColor}`,
          }}
          initial={{ top: "0%", opacity: 0 }}
          animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
        />

        <PositionCardHeader
          compact={compact}
          ticker={ticker}
          description={description}
          marketValue={marketValue}
          gainLoss={gainLoss}
          quantity={quantity}
          currentPrice={currentPrice}
          pricePaid={pricePaid}
          history={history}
          purchaseDate={purchaseDate}
          gainPositive={gainPositive}
          gainPct={gainPct}
          todayDelta={todayDelta}
          buy={buy}
          hold={hold}
          sell={sell}
          avgConfidence={avgConfidence}
          sentimentScore={sentimentMetrics.score}
          sentimentDirection={sentimentMetrics.direction}
          glowClass={effectiveGlowClass}
          isProposed={isProposed}
          targetPrice={targetPrice}
          targetShares={targetShares}
          hovered={_hovered}
          onAnalyzeTicker={onAnalyzeTicker}
          isTickerAnalyzing={isTickerAnalyzing}
        />

        <PositionCardNewsFeed
          compact={compact}
          loading={loading}
          hasContent={hasContent}
          ticker={ticker}
          pendingStories={pendingStories}
          congressTrades={congressTrades}
          storyGroups={storyGroups}
          sourceOrder={SOURCE_ORDER}
          sourcePriority={SOURCE_PRIORITY}
          agentState={agentState}
          prediction={prediction}
          allPredictions={allPredictions}
          resolvedStats={resolvedStats}
        />
      </div>
    </GlassView>
  );
}
