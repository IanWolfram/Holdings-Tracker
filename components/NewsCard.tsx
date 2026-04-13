"use client";

import { useRef, useState, useEffect, useId } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import VerdictBadge from "./VerdictBadge";
import GlassView from "./ui/LiquidGlass/GlassView";
import type { ClassifiedStory } from "@/types/news.types";

const R = 8; // border radius, must match card corner radius

// Smooth deceleration curve for border reveal/hide
const REVEAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const GROW_DURATION = 0.5;
const SHRINK_DURATION = 0.35;

const VERDICT_COLOR: Record<string, string> = {
  BUY: "#00FF88",
  SELL: "#FF4444",
  HOLD: "#64748b",
};

const HIGHLIGHT_COLOR: Record<string, string> = {
  BUY: "#ccffeb",
  SELL: "#ffd6cc",
  HOLD: "#cbd5e1",
};

export default function NewsCard({ story }: { story: ClassifiedStory }) {
  const articleRef = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const [hovered, setHovered] = useState(false);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const { w, h } = dims;
  const color = VERDICT_COLOR[story.verdict] ?? "#64748b";
  const highlight = HIGHLIGHT_COLOR[story.verdict] ?? "#86efac";

  // Measure card dimensions for SVG overlay
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

  const timeAgo = story.datetime
    ? formatDistanceToNow(new Date(story.datetime * 1000), { addSuffix: true })
    : "";

  const midX = w / 2;
  const midY = h / 2;


  // Define the paths for the border animation.
  // perimeterPath is removed per user request to simplify border visuals.

  // The 4 corner "cap" paths for the reveal animation on enter.
  // Inset by 1px to prevent clipping at SVG boundaries.
  const capPaths = w > 0 ? {
    topLeft: `M 1.5 12 L 1.5 ${R} Q 1.5 1.5 ${R} 1.5 L ${midX} 1.5`,
    topRight: `M ${w - 1.5} 12 L ${w - 1.5} ${R} Q ${w - 1.5} 1.5 ${w - R} 1.5 L ${midX} 1.5`,
    bottomLeft: `M 1.5 ${h - 12} L 1.5 ${h - R} Q 1.5 ${h - 1.5} ${R} ${h - 1.5} L ${midX} ${h - 1.5}`,
    bottomRight: `M ${w - 1.5} ${h - 12} L ${w - 1.5} ${h - R} Q ${w - 1.5} ${h - 1.5} ${w - R} ${h - 1.5} L ${midX} ${h - 1.5}`,
  } : null;

  return (
    <GlassView
      layout
      layoutId={id}
      interactive
      cornerRadius={R}
      className={`relative cursor-pointer group/item news-item-frame rounded-[8px] border-${story.verdict.toLowerCase()}`}
      onClick={() => window.open(story.url, "_blank")}
    >
      <div
        ref={articleRef}
        className="p-3 relative"
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
          transition={{ duration: 1.2, ease: "easeInOut", delay: 0.1 }}
        />

        {/* Animated border SVG */}
        {w > 0 && (
          <svg
            className="absolute inset-0 pointer-events-none overflow-visible"
            width={w}
            height={h}
            style={{
              zIndex: 1,
              filter: hovered
                ? `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})`
                : "none",
              transition: "filter 0.4s ease",
            }}
          >
            <defs>
              <linearGradient id={`fadeGradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="60%" stopColor="white" stopOpacity="1" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <mask id={`topMask-${id}`}>
                <rect x="-10" y="0" width={w + 20} height="20" fill={`url(#fadeGradient-${id})`} />
              </mask>
              <mask id={`bottomMask-${id}`}>
                <g transform={`translate(0, ${h}) scale(1, -1)`}>
                  <rect x="-10" y="0" width={w + 20} height="20" fill={`url(#fadeGradient-${id})`} />
                </g>
              </mask>
            </defs>


            {capPaths && (
              <g stroke={color} strokeWidth={1} fill="none" strokeLinecap="round">
                <g mask={`url(#topMask-${id})`}>
                  <motion.path
                    d={capPaths.topLeft}
                    initial={{ pathLength: 0.1, opacity: 0.2 }}
                    animate={{ pathLength: hovered ? 1 : 0.1, opacity: hovered ? 1 : 0.2 }}
                    transition={{ duration: 0.4, ease: REVEAL_EASE }}
                  />
                  <motion.path
                    d={capPaths.topRight}
                    initial={{ pathLength: 0.1, opacity: 0.2 }}
                    animate={{ pathLength: hovered ? 1 : 0.1, opacity: hovered ? 1 : 0.2 }}
                    transition={{ duration: 0.4, ease: REVEAL_EASE, delay: 0.02 }}
                  />
                </g>
                <g mask={`url(#bottomMask-${id})`}>
                  <motion.path
                    d={capPaths.bottomLeft}
                    initial={{ pathLength: 0.1, opacity: 0.2 }}
                    animate={{ pathLength: hovered ? 1 : 0.1, opacity: hovered ? 1 : 0.2 }}
                    transition={{ duration: 0.4, ease: REVEAL_EASE, delay: 0.04 }}
                  />
                  <motion.path
                    d={capPaths.bottomRight}
                    initial={{ pathLength: 0.1, opacity: 0.2 }}
                    animate={{ pathLength: hovered ? 1 : 0.1, opacity: hovered ? 1 : 0.2 }}
                    transition={{ duration: 0.4, ease: REVEAL_EASE, delay: 0.06 }}
                  />
                </g>
              </g>
            )}
          </svg>
        )}

        {/* Content (reveal following scanline) */}
        <motion.div
          className="relative"
          style={{ zIndex: 2 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <VerdictBadge verdict={story.verdict} confidence={story.confidence} />

          <a
            href={story.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[13px] font-semibold leading-snug line-clamp-2 group-hover/item:text-white transition-colors"
          >
            {story.headline}
          </a>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              {story.source === "finnhub" ? (
                <span className="border border-positive px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Image src="/finnhub-logo.png" alt="Finnhub" width={12} height={12} className="object-contain" />
                  <span className="text-positive font-bold">Finnhub</span>
                </span>
              ) : (
                <span className="bg-black px-1.5 py-0.5 rounded border border-white/20 flex items-center gap-1">
                  <Image src="/x-logo.png" alt="X" width={10} height={10} className="object-contain invert" />
                  <span className="text-white font-bold">{story.author ? `@${story.author}` : "X"}</span>
                </span>
              )}
              {timeAgo && <span>{timeAgo}</span>}
            </div>
            <motion.div
              className="flex items-center justify-center relative w-[32px] h-[32px]"
              animate={{ 
                rotate: hovered ? -45 : 0,
                scale: hovered ? 1.1 : 1,
              }}
              transition={{ duration: 0.4, ease: REVEAL_EASE }}
            >
              <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full overflow-visible">
                {/* Symmetrical Arrow Path: Modern Modern Line Arrow */}
                <path 
                  d="M 4 12 H 20 M 14 6 L 20 12 L 14 18" 
                  fill="none" 
                  stroke={hovered ? (story.source === "finnhub" ? "#00FF88" : "#000000") : "#64748b"} 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="transition-colors duration-400"
                  style={{ 
                    opacity: hovered ? 1 : 0.4,
                    filter: (hovered && story.source !== "finnhub") ? "drop-shadow(0 0 2px rgba(255,255,255,0.8))" : "none"
                  }}
                />
                
              </svg>
            </motion.div>
          </div>

          {story.reason && (
            <p className="mt-1 text-[10px] text-slate-600 italic line-clamp-1">{story.reason}</p>
          )}
        </motion.div>
      </div>
    </GlassView>
  );
}
