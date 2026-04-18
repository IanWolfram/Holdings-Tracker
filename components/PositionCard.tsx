"use client";

import { useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import NewsCard from "./NewsCard";
import CongressTradeCard from "./CongressTradeCard";
import NewsCollapsible from "./NewsCollapsible";
import { FinnhubBadge, XBadge, RedditBadge } from "./mediabadges";
import GlassContainer from "./ui/LiquidGlass/GlassContainer";
import GlassView from "./ui/LiquidGlass/GlassView";
import Sparkline from "./ui/Sparkline";
import CompanyLogo from "./ui/CompanyLogo";
import { formatCurrency, formatPercent, formatGainLoss } from "@/lib/utils/format";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory, CongressTrade } from "@/types/news.types";

// Sort order for news source groups (lower = first)
const SOURCE_ORDER = ["twitter", "reddit", "finnhub", "newsapi"] as const;
const SOURCE_PRIORITY: Record<string, number> = { twitter: 0, reddit: 1, finnhub: 2, newsapi: 3 };


function SourceBadge({ source }: { source: string }) {
  if (source === "finnhub") return <FinnhubBadge />;
  if (source === "reddit") return <RedditBadge />;
  if (source === "twitter") return <XBadge />;
  return <span className="text-[10px] text-slate-500 font-bold">News</span>;
}

const POSITION_R = 12;

interface Props {
  position: Position;
  stories: ClassifiedStory[];
  congressTrades?: CongressTrade[];
  loading: boolean;
  frosted?: boolean;
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

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1].map((i) => (
        <div key={i} className={`space-y-2 animate-pulse ${i === 1 ? "opacity-60" : ""}`}>
          <div className="h-3 w-12 bg-slate-800 rounded-sm" />
          <div className="h-4 w-full bg-slate-700 rounded-sm" />
          <div className="h-4 w-3/4 bg-slate-700 rounded-sm" />
          <div className="h-2 w-20 bg-slate-800 rounded-sm mt-4" />
        </div>
      ))}
    </div>
  );
}

export default function PositionCard({ position, stories, congressTrades = [], loading, frosted }: Props) {
  const articleRef = useRef<HTMLDivElement>(null);
  const [_hovered, setHovered] = useState(false);

  const { ticker, description, marketValue, gainLoss, quantity, currentPrice, pricePaid, history } = position;

  const buy = stories.filter((s) => s.verdict === "BUY").length;
  const sell = stories.filter((s) => s.verdict === "SELL").length;
  const hold = stories.filter((s) => s.verdict === "HOLD").length;

  const verdictScore = (buy + sell) > 0 ? buy / (buy + sell) : (hold > 0 ? 0.5 : 0.5);
  const gainPositive = gainLoss >= 0;
  const gainStr = formatGainLoss(gainLoss);
  const gainPct = pricePaid > 0 ? ((currentPrice - pricePaid) / pricePaid) * 100 : 0;
  const gainPctStr = formatPercent(gainPct);
  const mvStr = formatCurrency(marketValue);
  const priceStr = formatCurrency(currentPrice);

  // Group stories by source, each group sorted by recency (newest first)
  const storyGroups = useMemo(() => {
    const groups: Record<string, ClassifiedStory[]> = {};
    for (const story of stories) {
      const src = story.source || "newsapi";
      if (!groups[src]) groups[src] = [];
      groups[src].push(story);
    }
    // Sort each group by datetime descending (most recent first)
    for (const src of Object.keys(groups)) {
      groups[src].sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0));
    }
    return groups;
  }, [stories]);

  const hasContent = stories.length > 0 || congressTrades.length > 0;


  const highlight = verdictScore > 0.5 ? "#ccffeb" : verdictScore < 0.5 ? "#ffd6cc" : "#cbd5e1";

  return (
    <GlassView
      layout
      layoutId={ticker}
      cornerRadius={POSITION_R}
      className="relative flex flex-col group shadow-2xl transition-all duration-300"
      style={{
        backgroundColor: frosted ? "rgba(8, 13, 9, 0.92)" : "rgba(0, 0, 0, 0.6)",
        backdropFilter: frosted ? "blur(48px) saturate(130%) brightness(1.06) contrast(0.92)" : undefined,
        WebkitBackdropFilter: frosted ? "blur(48px) saturate(130%) brightness(1.06) contrast(0.92)" : undefined,
        // Override glass-material border: neutral sides, let ticker-header-glow provide the top accent
        border: frosted ? "1px solid rgba(255,255,255,0.07)" : undefined,
        borderTop: frosted ? "1.5px solid rgba(255,255,255,0.1)" : undefined,
        overflow: "hidden",
      }}
    >
      <div
        ref={articleRef}
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Scanline reveal sweep */}
        <motion.div
          className="absolute inset-x-0 h-[2px] z-50 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, ${highlight}, transparent)`,
            boxShadow: `0 0 10px ${highlight}, 0 0 20px ${highlight}`,
          }}
          initial={{ top: "0%", opacity: 0 }}
          animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
        />


        {/* Card header with glow */}
        <div className={`ticker-header-glow ${glowClass(buy, sell, loading)}`}>

          {/* CardHeader */}
          <div className="p-4 pb-2">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="font-mono text-2xl font-black text-white tracking-tighter leading-none">{ticker}</h1>

                    <CompanyLogo ticker={ticker} size={38} radius={9} />
                  </div>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest opacity-80 max-w-[65%] wrap-break-words" title={description}>
                    {description}
                  </p>
                  <h2 className="font-mono text-xl font-bold text-white leading-none tracking-tight mt-1">{mvStr}</h2>
                  <span className="font-mono text-[9px] font-medium text-slate-400">
                    {priceStr} <span className="opacity-50 text-[8px]">/ SH</span>
                  </span>
                </div>
                <div className="shrink-0">
                  <Sparkline data={history || []} width={130} height={56} />
                </div>
              </div>
            </div>
          </div>

          {/* Gain row */}
          <div className="px-4 py-2 flex justify-between items-center border-t border-white/[0.03] bg-black/20">
            <div className={`gain-row font-mono flex items-baseline gap-2 ${gainPositive ? "text-positive" : "text-negative"}`}>
              <span className="text-sm font-black">{gainStr}</span>
              <span className="text-[10px] font-bold opacity-80">{gainPctStr}</span>
            </div>
            <span className="shares-text font-mono text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              {quantity} <span className="opacity-40">SHARES</span>
            </span>
          </div>

          {/* Verdict bar */}
          <div className="px-4 py-3 border-t border-white/[0.05] bg-zinc-950/40">
            <div className="flex flex-col gap-2">
              <div className="verdict-bar w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                <div
                  className="bar-green bg-positive transition-all duration-1000 ease-out"
                  style={{ width: `${verdictScore * 100}%`, boxShadow: "0 0 10px rgba(0, 255, 136, 0.3)" }}
                />
                <div
                  className="bar-red bg-negative transition-all duration-1000 ease-out"
                  style={{ width: `${(1 - verdictScore) * 100}%`, boxShadow: "0 0 10px rgba(255, 68, 68, 0.3)" }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="verdict-label text-[9px] font-black text-slate-500 tracking-[0.2em] uppercase">Verdict</span>
                <span className={`text-[10px] font-mono font-bold ${verdictScore > 0.5 ? "text-positive" : verdictScore < 0.5 ? "text-negative" : "text-slate-400"}`}>
                  {verdictScore > 0.5 ? "BULLISH" : verdictScore < 0.5 ? "BEARISH" : "NEUTRAL"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* News feed — grouped by source */}
        <GlassContainer className="flex-1 p-3 border-t border-white/[0.05]">
          {loading && !hasContent && <LoadingSkeleton />}

          {!loading && !hasContent && (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-center opacity-40">
              <span className="material-symbols-outlined text-3xl">info</span>
              <p className="text-[10px] font-bold uppercase tracking-wider">No recent news</p>
            </div>
          )}

          {hasContent && (
            <div className="space-y-3">
              {/* Congress trades — always first */}
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

              {/* News story decks — one per source, ordered twitter → reddit → finnhub → newsapi */}
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

              {/* Any sources not in SOURCE_ORDER */}
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
