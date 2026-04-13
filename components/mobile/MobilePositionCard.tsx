"use client";

import React from "react";
import { formatCurrency, formatGainLoss, formatPercent } from "@/lib/utils/format";
import type { Position } from "@/types/position.types";
import type { ClassifiedStory } from "@/types/news.types";
import GlassContainer from "../ui/LiquidGlass/GlassContainer";
import GlassView from "../ui/LiquidGlass/GlassView";

interface MobilePositionCardProps {
  position: Position;
  stories: ClassifiedStory[];
}

export default function MobilePositionCard({ position, stories }: MobilePositionCardProps) {
  const { ticker, description, marketValue, currentPrice, pricePaid, gainLoss } = position;

  const buy = stories.filter((s) => s.verdict === "BUY").length;
  const sell = stories.filter((s) => s.verdict === "SELL").length;
  const hold = stories.filter((s) => s.verdict === "HOLD").length;
  
  const total = buy + sell;
  const verdictScore = total > 0 ? buy / total : (hold > 0 ? 0.5 : 0.5);
  const isBullish = verdictScore > 0.5;
  const isBearish = verdictScore < 0.5;

  const gainPositive = gainLoss >= 0;
  const gainPct = pricePaid > 0 ? ((currentPrice - pricePaid) / pricePaid) * 100 : 0;
  const isHot = gainPct > 10;

  // Determine icon based on ticker (default to bolt/analytics)
  const icon = isBullish ? "bolt" : "analytics";
  const glowClass = isBullish ? "ticker-header-glow-green" : "ticker-header-glow-red";

  return (
    <div className={`glass-material rounded-xl overflow-hidden ${glowClass} border-white/10 shadow-2xl transition-all duration-500`}>
      <div className="relative z-10">
        {/* Card Header Content */}
        <div className="p-4 border-b border-white/5 bg-white/[0.01]">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-start gap-3">
              <div className="bg-white/5 w-11 h-11 rounded-lg flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-colors">
                <span className={`material-symbols-outlined ${isBullish ? "text-positive" : "text-negative"} text-xl`}>{icon}</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="font-headline font-bold text-xl text-white tracking-tight leading-none">{ticker}</h3>
                  {isHot && (
                    <span className="bg-negative text-white text-[8px] px-1 py-0.5 font-black rounded-sm uppercase tracking-wider animate-pulse">Hot</span>
                  )}
                </div>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold mt-1 opacity-70 truncate max-w-[130px]">{description}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-headline font-bold text-2xl text-white tracking-tight">{formatCurrency(marketValue)}</p>
              <p className={`text-[10px] font-mono ${gainPositive ? "text-positive" : "text-negative"} font-bold`}>
                {formatGainLoss(gainLoss)} <span className="opacity-60">{formatPercent(gainPct)}</span>
              </p>
            </div>
          </div>
          
          {/* Verdict Bar */}
          <div className="space-y-2">
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-positive transition-all duration-1000 ease-out" 
                style={{ width: `${verdictScore * 100}%`, boxShadow: "0 0 10px rgba(0, 255, 136, 0.4)" }}
              ></div>
              <div 
                className="h-full bg-negative transition-all duration-1000 ease-out" 
                style={{ width: `${(1 - verdictScore) * 100}%`, boxShadow: "0 0 10px rgba(255, 68, 68, 0.4)" }}
              ></div>
            </div>
            <div className="flex justify-between text-[9px] uppercase font-bold tracking-[0.2em] items-center">
              <span className="text-on-surface-variant opacity-60">Verdict Analysis</span>
              <span className={`${isBullish ? "text-positive" : isBearish ? "text-negative" : "text-on-surface-variant"} transition-colors duration-500`}>
                {isBullish ? "Bullish" : isBearish ? "Bearish" : "Neutral"}
              </span>
            </div>
          </div>
        </div>

        {/* News Feed with Liquid Glass Integration */}
        <div className="bg-black/40">
          <GlassContainer className="p-3 space-y-3">
            {stories.length === 0 && (
              <p className="text-[10px] text-on-surface-variant text-center py-6 uppercase font-bold tracking-widest opacity-30">No recent market pulse</p>
            )}
            {stories.map((story, idx) => {
              const storyColor = story.verdict === 'BUY' ? 'text-positive' : story.verdict === 'SELL' ? 'text-negative' : 'text-slate-500';
              const storyBg = story.verdict === 'BUY' ? 'bg-positive/20' : story.verdict === 'SELL' ? 'bg-negative/20' : 'bg-slate-500/10';
              
              return (
                <GlassView key={idx} className={`relative block rounded-lg group/item`}>
                  <div className={`news-item-frame p-4 border border-white/5 hover:border-white/10 transition-all duration-300 ${storyColor}`}>
                    {idx === 0 && <div className="scanline"></div>}
                    <div className="glass-reflection"></div>
                    
                    {/* Corner Caps - inheriting currentColor from storyColor */}
                    <div className="news-cap news-cap-top-left"></div>
                    <div className="news-cap news-cap-top-right"></div>
                    <div className="news-cap news-cap-bottom-left"></div>
                    <div className="news-cap news-cap-bottom-right"></div>

                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 ${storyBg} rounded-sm tracking-widest`}>
                          {story.verdict === 'BUY' ? 'Buy Signal' : story.verdict === 'SELL' ? 'Sell Signal' : 'Hold'}
                        </span>
                        <div className="flex items-center gap-1 opacity-70 text-[9px] font-mono font-bold uppercase">
                          <span className="text-white/40">Conf</span>
                          <span className="text-white">91%</span>
                        </div>
                      </div>
                      <h4 className="text-[14px] font-semibold text-white leading-snug mb-4 group-hover/item:text-white transition-colors">
                        {story.headline}
                      </h4>
                      <div className="flex items-center justify-between text-[10px] text-on-surface-variant font-bold">
                        <div className="flex items-center gap-2">
                          <span className={`${story.verdict === 'BUY' ? 'border-positive/40 text-positive' : 'border-white/20 text-white'} border px-2 py-0.5 rounded-sm text-[8px] uppercase tracking-tighter bg-white/5`}>
                            {story.source}
                          </span>
                          <span className="font-mono text-[9px] opacity-60">1h ago</span>
                        </div>
                        <span className="material-symbols-outlined text-[16px] group-hover/item:translate-x-0.5 group-hover/item:-translate-y-0.5 transition-transform duration-300">arrow_outward</span>
                      </div>
                    </div>
                  </div>
                </GlassView>
              );
            })}
          </GlassContainer>
        </div>
      </div>
    </div>
  );
}
