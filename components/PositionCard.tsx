"use client";

import { useRef, useState, useEffect, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import NewsCard from "./NewsCard";
import GlassContainer from "./ui/LiquidGlass/GlassContainer";
import GlassView from "./ui/LiquidGlass/GlassView";
import Sparkline from "./ui/Sparkline";
import { NEWS_PREVIEW_COUNT } from "@/lib/constants";
import { formatCurrency, formatPercent, formatGainLoss } from "@/lib/utils/format";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory } from "@/types/news.types";

const POSITION_R = 12; // border radius for PositionCard
const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Props {
  position: Position;
  stories: ClassifiedStory[];
  loading: boolean;
}

function glowClass(buy: number, sell: number, loading: boolean): string {
  if (loading) return "glow-neutral";
  if (buy > sell) return "glow-positive";
  if (sell > buy) return "glow-negative";
  return "glow-neutral";
}

export default function PositionCard({ position, stories, loading }: Props) {
  const articleRef = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const { ticker, description, marketValue, gainLoss, quantity, currentPrice, pricePaid, history } = position;

  const buy = stories.filter((s) => s.verdict === "BUY").length;
  const sell = stories.filter((s) => s.verdict === "SELL").length;
  const hold = stories.filter((s) => s.verdict === "HOLD").length;
  
  // Calculate verdict score for the ratio bar (0 to 1)
  const verdictScore = (buy + sell) > 0 ? buy / (buy + sell) : (hold > 0 ? 0.5 : 0.5);

  const gainPositive = gainLoss >= 0;
  const gainStr = formatGainLoss(gainLoss);

  const gainPct = pricePaid > 0 ? ((currentPrice - pricePaid) / pricePaid) * 100 : 0;
  const gainPctStr = formatPercent(gainPct);

  const mvStr = formatCurrency(marketValue);
  const priceStr = formatCurrency(currentPrice);

  const isHot = gainPct > 10;

  const visibleStories = expanded ? stories : stories.slice(0, NEWS_PREVIEW_COUNT);
  const hiddenCount = stories.length - NEWS_PREVIEW_COUNT;

  // Measurement logic for SVG border
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setDims({ w: rect.width, h: rect.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = dims;
  const midX = w / 2;

  // Determine border color based on verdict score
  const color = verdictScore > 0.5 ? "#00FF88" : verdictScore < 0.5 ? "#FF4444" : "#64748b";
  const highlight = verdictScore > 0.5 ? "#ccffeb" : verdictScore < 0.5 ? "#ffd6cc" : "#cbd5e1";

  const capPaths = w > 0 ? {
    topLeft: `M 1.5 20 L 1.5 ${POSITION_R} Q 1.5 1.5 ${POSITION_R} 1.5 L ${midX} 1.5`,
    topRight: `M ${w - 1.5} 20 L ${w - 1.5} ${POSITION_R} Q ${w - 1.5} 1.5 ${w - POSITION_R} 1.5 L ${midX} 1.5`,
    bottomLeft: `M 1.5 ${h - 20} L 1.5 ${h - POSITION_R} Q 1.5 ${h - 1.5} ${POSITION_R} ${h - 1.5} L ${midX} ${h - 1.5}`,
    bottomRight: `M ${w - 1.5} ${h - 20} L ${w - 1.5} ${h - POSITION_R} Q ${w - 1.5} ${h - 1.5} ${w - POSITION_R} ${h - 1.5} L ${midX} ${h - 1.5}`,
  } : null;

  return (
    <GlassView
      layout
      layoutId={ticker}
      cornerRadius={POSITION_R}
      className={`relative flex flex-col group shadow-2xl transition-all duration-300`}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
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

        {/* Animated border SVG */}
        {w > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none overflow-visible"
            width={w}
            height={h}
            style={{
              zIndex: 30,
              filter: hovered
                ? `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})`
                : "none",
              transition: "filter 0.4s ease",
            }}
          >
            <defs>
              <linearGradient id={`fadeGradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="40%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <mask id={`topMask-${id}`}>
                <rect x="-10" y="0" width={w + 20} height={40} fill={`url(#fadeGradient-${id})`} />
              </mask>
              <mask id={`bottomMask-${id}`}>
                <g transform={`translate(0, ${h}) scale(1, -1)`}>
                  <rect x="-10" y="0" width={w + 20} height={40} fill={`url(#fadeGradient-${id})`} />
                </g>
              </mask>
            </defs>

            {capPaths && (
              <g stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round">
                <g mask={`url(#topMask-${id})`}>
                  <motion.path
                    d={capPaths.topLeft}
                    initial={{ pathLength: 0.1, opacity: 0 }}
                    animate={{ pathLength: hovered ? 1 : 0.1, opacity: hovered ? 1 : 0.3 }}
                    transition={{ duration: 0.6, ease: REVEAL_EASE }}
                  />
                  <motion.path
                    d={capPaths.topRight}
                    initial={{ pathLength: 0.1, opacity: 0 }}
                    animate={{ pathLength: hovered ? 1 : 0.1, opacity: hovered ? 1 : 0.3 }}
                    transition={{ duration: 0.6, ease: REVEAL_EASE, delay: 0.05 }}
                  />
                </g>
                <g mask={`url(#bottomMask-${id})`}>
                  <motion.path
                    d={capPaths.bottomLeft}
                    initial={{ pathLength: 0.1, opacity: 0 }}
                    animate={{ pathLength: hovered ? 1 : 0.1, opacity: hovered ? 1 : 0.3 }}
                    transition={{ duration: 0.6, ease: REVEAL_EASE, delay: 0.1 }}
                  />
                  <motion.path
                    d={capPaths.bottomRight}
                    initial={{ pathLength: 0.1, opacity: 0 }}
                    animate={{ pathLength: hovered ? 1 : 0.1, opacity: hovered ? 1 : 0.3 }}
                    transition={{ duration: 0.6, ease: REVEAL_EASE, delay: 0.15 }}
                  />
                </g>
              </g>
            )}
          </svg>
        )}

        {/* Card Wrapper with Glow Header */}
        <div className={`ticker-header-glow ${glowClass(buy, sell, loading)}`}>
          
          {/* Phase 1: CardHeader */}
          <div className="p-4 pb-2">
            <div className="flex justify-between items-end mb-1 gap-2">
              <div className="ticker-group shrink-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-mono text-2xl font-black text-white tracking-tighter leading-none">{ticker}</h1>
                  {isHot && (
                    <span className="bg-negative text-white text-[8px] font-black px-1 rounded-sm animate-pulse">HOT</span>
                  )}
                </div>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-80 truncate max-w-[110px]" title={description}>
                  {description}
                </p>
              </div>

              {/* Injected small graph between ticker and price */}
              <div className="flex-1 flex justify-center px-2 -mb-0.5 opacity-100 transition-opacity duration-500 overflow-hidden">
                <Sparkline data={history || []} width={100} height={22} />
              </div>
              
              <div className="price-group text-right shrink-0">
                <h2 className="font-mono text-xl font-bold text-white leading-none tracking-tight">{mvStr}</h2>
                <p className="font-mono text-[9px] font-medium text-slate-400 mt-0.5">
                  {priceStr} <span className="opacity-50 text-[8px]">/ SH</span>
                </p>
              </div>
            </div>
          </div>

          {/* Phase 2: CardStats (Gain Row) */}
          <div className="px-4 py-2 flex justify-between items-center border-t border-white/[0.03] bg-black/20">
            <div className={`gain-row font-mono flex items-baseline gap-2 ${gainPositive ? "text-positive" : "text-negative"}`}>
              <span className="text-sm font-black">{gainStr}</span>
              <span className="text-[10px] font-bold opacity-80">{gainPctStr}</span>
            </div>
            <span className="shares-text font-mono text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              {quantity} <span className="opacity-40">SHARES</span>
            </span>
          </div>

          {/* Phase 4: CardFooter (Verdict Bar) */}
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

        {/* News feed inside a Shared Glass Container */}
        <GlassContainer className="flex-1 p-3 border-t border-white/[0.05]">
          <div className="space-y-3 relative">
            {loading && stories.length === 0 && <LoadingSkeleton />}

            {!loading && stories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-center opacity-40">
                <span className="material-symbols-outlined text-3xl">info</span>
                <p className="text-[10px] font-bold uppercase tracking-wider">No recent news</p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {visibleStories.map((story, i) => (
                <motion.div
                  key={`${story.url}-${i}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <div className="mb-3">
                    <NewsCard story={story} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </GlassContainer>

        {/* Expand / collapse toggle */}
        {stories.length > NEWS_PREVIEW_COUNT && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-center gap-2 py-2 border-t border-white/5 bg-surface-container-low/80 hover:bg-white/[0.03] transition-colors group/toggle"
          >
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover/toggle:text-slate-300 transition-colors">
              {expanded ? "Collapse" : `${hiddenCount} more insights`}
            </span>
            <span
              className={`material-symbols-outlined text-[16px] text-slate-600 group-hover/toggle:text-slate-300 transition-all duration-300 ${expanded ? "rotate-180" : ""}`}
            >
              expand_more
            </span>
          </button>
        )}
      </div>
    </GlassView>
  );
}

function LoadingSkeleton() {
  return (
    <>
      {[0, 1].map((i) => (
        <div key={i} className={`space-y-2 animate-pulse ${i === 1 ? "opacity-60" : ""}`}>
          <div className="h-3 w-12 bg-slate-800 rounded-sm" />
          <div className="h-4 w-full bg-slate-700 rounded-sm" />
          <div className="h-4 w-3/4 bg-slate-700 rounded-sm" />
          <div className="h-2 w-20 bg-slate-800 rounded-sm mt-4" />
        </div>
      ))}
    </>
  );
}

