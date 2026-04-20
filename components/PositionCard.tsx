"use client";

import { useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import NewsCard from "./NewsCard";
import PendingNewsCard from "./PendingNewsCard";
import CongressTradeCard from "./CongressTradeCard";
import NewsCollapsible from "./NewsCollapsible";
import { FinnhubBadge, XBadge, RedditBadge } from "./mediabadges";
import GlassContainer from "./ui/LiquidGlass/GlassContainer";
import GlassView from "./ui/LiquidGlass/GlassView";
import Sparkline from "./ui/Sparkline";
import CompanyLogo from "./ui/CompanyLogo";
import SentimentBar from "./SentimentBar";
import EmptyState from "./EmptyState";
import { formatCurrency, formatPercent, formatGainLoss } from "@/lib/utils/format";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";
import type { AgentProgress } from "@/lib/agent/service";

const SOURCE_ORDER = ["twitter", "reddit", "finnhub", "newsapi"] as const;
const SOURCE_PRIORITY: Record<string, number> = { twitter: 0, reddit: 1, finnhub: 2, newsapi: 3 };
const POSITION_R = 12;

function SourceBadge({ source }: { source: string }) {
  if (source === "finnhub") return <FinnhubBadge />;
  if (source === "reddit") return <RedditBadge />;
  if (source === "twitter") return <XBadge />;
  return <span className="text-[10px] text-slate-500 font-bold">News</span>;
}

interface Props {
  position: Position;
  stories: ClassifiedStory[];
  congressTrades?: CongressTrade[];
  loading: boolean;
  frosted?: boolean;
  agentState?: AgentProgress;
}

function glowClass(buy: number, sell: number, loading: boolean): string {
  if (loading) return "glow-neutral";
  if (buy > sell) return "glow-positive";
  if (sell > buy) return "glow-negative";
  return "glow-neutral";
}

function CongressHeader() {
  return (
    <span className="flex items-center gap-1">
      <span className="material-symbols-outlined text-[15px]" style={{ color: "#b45309" }}>
        gavel
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#b45309" }}>
        Congress
      </span>
    </span>
  );
}

export default function PositionCard({
  position,
  stories,
  congressTrades = [],
  loading,
  frosted,
  agentState,
}: Props) {
  const articleRef = useRef<HTMLDivElement>(null);
  const [_hovered, setHovered] = useState(false);

  const {
    ticker,
    description,
    marketValue,
    gainLoss,
    quantity,
    currentPrice,
    pricePaid,
    history,
  } = position;

  // Sentiment counts — now tri-state
  const buy = stories.filter((s) => s.verdict === "BUY").length;
  const sell = stories.filter((s) => s.verdict === "SELL").length;
  const hold = stories.filter((s) => s.verdict === "HOLD").length;
  const avgConfidence = stories.length
    ? (stories.reduce((acc, s) => acc + (s.confidence ?? 0), 0) / stories.length) * 100
    : undefined;

  const gainPositive = gainLoss >= 0;
  const gainPct = pricePaid > 0 ? ((currentPrice - pricePaid) / pricePaid) * 100 : 0;

  // Today's move: derived from history if available (last two points), else 0.
  const todayDelta = useMemo(() => {
    if (!history || history.length < 2) return null;
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    if (typeof last !== "number" || typeof prev !== "number" || prev === 0) return null;
    const diff = (last - prev) * quantity;
    const pct = ((last - prev) / prev) * 100;
    return { diff, pct };
  }, [history, quantity]);

  // Group stories by analyzed status and source
  const { pendingStories, storyGroups } = useMemo(() => {
    const pending: ClassifiedStory[] = [];
    const groups: Record<string, ClassifiedStory[]> = {};

    for (const story of stories) {
      if (story.isAnalyzed !== true) {
        pending.push(story);
        continue;
      }
      const src = story.source || "newsapi";
      if (!groups[src]) groups[src] = [];
      groups[src].push(story);
    }

    for (const src of Object.keys(groups)) {
      groups[src].sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0));
    }

    return {
      pendingStories: pending.sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0)),
      storyGroups: groups,
    };
  }, [stories]);

  const hasContent = stories.length > 0 || congressTrades.length > 0;

  const scanColor = buy > sell ? "#00FF88" : sell > buy ? "#FF4444" : "#cbd5e1";

  return (
    <GlassView
      layout
      layoutId={ticker}
      cornerRadius={POSITION_R}
      className="relative flex flex-col group shadow-2xl transition-all duration-300"
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
      <div
        ref={articleRef}
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Scanline reveal */}
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

        <div className={`ticker-header-glow ${glowClass(buy, sell, loading)}`}>
          {/* ── Header (logo-left anchor) ── */}
          <div className="p-4 pb-3">
            <div className="grid grid-cols-[auto_1fr_auto] gap-3.5 items-start">
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <CompanyLogo ticker={ticker} size={44} radius={10} />
                <span
                  className={`font-mono text-[11px] font-black tracking-tight ${
                    gainPositive ? "text-positive" : "text-negative"
                  }`}
                >
                  {gainPositive ? "▲" : "▼"}&nbsp;{Math.abs(gainPct).toFixed(2)}%
                </span>
              </div>
              <div className="min-w-0 flex flex-col gap-0.5">
                {/* Row 1: ticker only */}
                <div className="flex items-center gap-2">
                  <h1 className="font-mono text-[22px] font-black text-white tracking-tighter leading-none shrink-0">
                    {ticker}
                  </h1>
                </div>
                {/* Row 2: full company name */}
                <p
                  className="text-[10px] text-slate-400 font-medium leading-tight truncate max-w-full"
                  title={description}
                >
                  {description}
                </p>
                {/* Row 3: price per share */}
                <span className="font-mono text-[10px] text-slate-500 font-medium">
                  {formatCurrency(currentPrice)}&thinsp;<span className="opacity-50 text-[9px]">/ SH</span>
                </span>
              </div>
              <div className="shrink-0">
                <Sparkline data={history || []} width={120} height={44} />
              </div>
            </div>
          </div>

          {/* ── 3-stat row ── */}
          <div className="flex border-t border-white/[0.06]">
            <div className="flex-1 py-3 px-2 flex items-center justify-center">
              <Stat
                label="Market Val"
                value={formatCurrency(marketValue)}
                sub={`${quantity} sh · ${formatCurrency(currentPrice)}`}
                align="center"
              />
            </div>
            <div className="w-px bg-white/[0.06]" />
            <div className="flex-1 py-3 px-2 flex items-center justify-center">
              <Stat
                label="Unrealized"
                value={formatGainLoss(gainLoss)}
                valueClass={gainPositive ? "text-positive" : "text-negative"}
                sub={`Bought at ${formatCurrency(pricePaid)} / SH`}
                align="center"
              />
            </div>
            <div className="w-px bg-white/[0.06]" />
            <div className="flex-1 py-3 px-2 flex items-center justify-center">
              <Stat
                label="Today"
                value={
                  todayDelta
                    ? `${todayDelta.diff >= 0 ? "+" : ""}${formatCurrency(todayDelta.diff)}`
                    : "—"
                }
                valueClass={
                  todayDelta
                    ? todayDelta.diff >= 0
                      ? "text-positive"
                      : "text-negative"
                    : "text-slate-400"
                }
                sub={todayDelta ? `${formatPercent(todayDelta.pct)}` : "no intraday"}
                align="center"
              />
            </div>
          </div>

          {/* ── Sentiment strip ── */}
          <div className="px-4 py-3 border-t border-white/[0.05] bg-black/[0.35]">
            <SentimentBar
              buy={buy}
              hold={hold}
              sell={sell}
              avgConfidence={avgConfidence}
            />
          </div>
        </div>

        {/* ── News feed (unchanged) ── */}
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

              {SOURCE_ORDER.filter((src) => storyGroups[src]?.length).map((src) => {
                const group = storyGroups[src];
                return (
                  <NewsCollapsible
                    key={src}
                    badge={<SourceBadge source={src} />}
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
                .filter((src) => SOURCE_PRIORITY[src] === undefined)
                .map((src) => {
                  const group = storyGroups[src];
                  return (
                    <NewsCollapsible
                      key={src}
                      badge={<SourceBadge source={src} />}
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
      </div>
    </GlassView>
  );
}

/* ─── Internal ─── */

interface StatProps {
  label: string;
  value: string;
  valueClass?: string;
  sub: string;
  align?: "left" | "center" | "right";
}

function Stat({ label, value, valueClass = "text-white", sub, align = "left" }: StatProps) {
  const alignClass = align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left";
  return (
    <div className={`flex flex-col gap-1 ${alignClass}`}>
      <span className="font-mono text-[9px] font-bold text-slate-500 tracking-[0.2em] uppercase">
        {label}
      </span>
      <span className={`font-mono text-[14px] font-bold leading-none tracking-tight ${valueClass}`}>
        {value}
      </span>
      <span className="font-mono text-[9.5px] font-medium text-slate-400 leading-snug break-words" title={sub}>
        {sub}
      </span>
    </div>
  );
}
