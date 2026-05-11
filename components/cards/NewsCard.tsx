"use client";

import NewsCardAiPanel from "@/components/news/NewsCardAiPanel";
import {
  CARD_RADIUS,
  HOVER_EXPAND_DELAY,
  REVEAL_EASE,
  getSourceColor,
} from "@/lib/utils/newsCardAnimations";
import type { ClassifiedStory } from "@/types/news.types";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { FinnhubBadge, PolygonBadge } from "@/components/mediabadges";
import GlassView from "@/components/ui/LiquidGlass/GlassView";

const VERDICT_COLOR: Record<string, string> = {
  BUY: "#00FF88",
  SELL: "#FF4444",
  HOLD: "#64748b",
};

const VERDICT_BG: Record<string, string> = {
  BUY: "rgba(0,255,136,0.08)",
  SELL: "rgba(255,68,68,0.08)",
  HOLD: "rgba(100,116,139,0.08)",
};

const VERDICT_PILL_BG: Record<string, string> = {
  BUY: "rgba(0,255,136,0.10)",
  SELL: "rgba(255,68,68,0.10)",
  HOLD: "rgba(100,116,139,0.12)",
};

/** Format a timestamp (seconds or milliseconds) into a human-readable "time ago" string. */
function formatTimeAgo(datetime: number | undefined): string {
  if (!datetime) return "";
  const isSeconds = datetime < 10_000_000_000;
  const ms = isSeconds ? datetime * 1_000 : datetime;
  return formatDistanceToNow(new Date(ms), { addSuffix: true });
}

/** Source badge icon: Finnhub, Polygon, or generic "News". */
function SourceBadgeIcon({ source }: { source: string }) {
  if (source === "finnhub") return <FinnhubBadge />;
  if (source === "polygon") return <PolygonBadge />;
  return <span className="text-[10px] text-slate-400 font-bold">News</span>;
}

/** Animated arrow icon that rotates on hover. */
function NavArrowIcon({ hovered, sourceColor }: { hovered: boolean; sourceColor: string }) {
  return (
    <motion.div
      className="flex items-center justify-center relative w-4 h-4 shrink-0"
      animate={{
        rotate: hovered ? -45 : 0,
        scale: hovered ? 1.1 : 1,
      }}
      transition={{ duration: 0.4, ease: REVEAL_EASE }}
    >
      <svg
        viewBox="0 0 24 24"
        className="absolute inset-0 w-full h-full overflow-visible"
      >
        <path
          d="M 4 12 H 20 M 14 6 L 20 12 L 14 18"
          fill="none"
          stroke={hovered ? sourceColor : "#64748b"}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            opacity: hovered ? 1 : 0.4,
            filter: hovered ? `drop-shadow(0 0 2px ${sourceColor})` : "none",
          }}
        />
      </svg>
    </motion.div>
  );
}

/** Button to toggle the duplicate stories panel. */
function DupeToggleButton({
  count,
  color,
  expanded,
  onToggle,
  compact,
}: {
  count: number;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-expanded={expanded}
      aria-label={`${count} similar coverage stories`}
      className={`${compact ? "px-1 py-[1px]" : "ml-1 px-1.5 py-[1px]"} rounded-full text-[9px] font-bold tracking-wide tabular-nums transition-colors hover:bg-white/[0.06]`}
      style={{
        color,
        backgroundColor: "rgba(255,255,255,0.04)",
        border: `1px solid ${color}33`,
      }}
    >
      +{count}{compact ? "" : " similar"}
    </button>
  );
}

/** Expandable list of duplicate stories. */
function DuplicateList({
  duplicates,
  compact,
}: {
  duplicates: ClassifiedStory[];
  compact: boolean;
}) {
  if (duplicates.length === 0) return null;
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key="duplicates"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: REVEAL_EASE }}
        className="overflow-hidden"
      >
        <div
          className={`${compact ? "mt-1.5 pt-1.5 space-y-1" : "mt-2 pt-2 space-y-1.5"} border-t`}
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <div className={`${compact ? "text-[8.5px]" : "text-[9.5px]"} font-bold uppercase tracking-wider text-slate-500`}>
            Similar coverage
          </div>
          {duplicates.map((d) => (
            <DuplicateItem key={`${d.source}-${d.url}-${d.datetime}`} story={d} compact={compact} />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Single duplicate story row. */
function DuplicateItem({ story, compact }: { story: ClassifiedStory; compact: boolean }) {
  const timeAgo = formatTimeAgo(story.datetime);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        window.open(story.url, "_blank");
      }}
      className="w-full text-left flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
    >
      <SourceBadgeIcon source={story.source} />
      <span className={`flex-1 ${compact ? "text-[10px]" : "text-[11px]"} text-slate-300 line-clamp-1`}>
        {story.headline}
      </span>
      {timeAgo && (
        <span className={`${compact ? "text-[9px]" : "text-[10px]"} text-slate-500 shrink-0 tabular-nums`}>
          {timeAgo}
        </span>
      )}
    </button>
  );
}

/** Compact layout for small-form-factor news cards. */
function CompactCardContent({
  story,
  timeAgo,
  duplicates,
  dupeBadgeColor,
  showDuplicates,
  setShowDuplicates,
  hovered,
  sourceColor,
  color,
  expanded,
  activeIsAnalyzed,
  activeVerdict,
  verdictBg,
  confidence,
  activeReason,
}: {
  story: ClassifiedStory;
  timeAgo: string;
  duplicates: ClassifiedStory[];
  dupeBadgeColor: string;
  showDuplicates: boolean;
  setShowDuplicates: React.Dispatch<React.SetStateAction<boolean>>;
  hovered: boolean;
  sourceColor: string;
  color: string;
  expanded: boolean;
  activeIsAnalyzed: boolean;
  activeVerdict: string;
  verdictBg: string;
  confidence: number;
  activeReason: string | undefined;
}) {
  return (
    <>
      <div className="flex items-start gap-1.5">
        <p className="flex-1 min-w-0 text-[12px] font-semibold leading-[1.25] line-clamp-2 text-white transition-colors break-words m-0">
          {story.headline}
        </p>
      </div>

      <div className="mt-[3px] flex items-center gap-[5px] text-[10px] text-slate-500">
        <SourceBadgeIcon source={story.source} />
        {timeAgo && <span className="text-[10px]">{timeAgo}</span>}
        {duplicates.length > 0 && (
          <DupeToggleButton
            count={duplicates.length}
            color={dupeBadgeColor}
            expanded={showDuplicates}
            onToggle={() => setShowDuplicates((v) => !v)}
            compact
          />
        )}
        <span className="ml-auto" />
        <NavArrowIcon hovered={hovered} sourceColor={sourceColor} />
      </div>

      <NewsCardAiPanel
        hovered={expanded}
        color={color}
        activeIsAnalyzed={activeIsAnalyzed}
        activeVerdict={activeVerdict}
        verdictBg={verdictBg}
        confidence={confidence}
        activeReason={activeReason}
        compact
      />
    </>
  );
}

/** Default (non-compact) layout for news cards. */
function DefaultCardContent({
  story,
  timeAgo,
  duplicates,
  dupeBadgeColor,
  showDuplicates,
  setShowDuplicates,
  hovered,
  sourceColor,
  color,
  expanded,
  activeIsAnalyzed,
  activeVerdict,
  verdictBg,
  confidence,
  activeReason,
}: {
  story: ClassifiedStory;
  timeAgo: string;
  duplicates: ClassifiedStory[];
  dupeBadgeColor: string;
  showDuplicates: boolean;
  setShowDuplicates: React.Dispatch<React.SetStateAction<boolean>>;
  hovered: boolean;
  sourceColor: string;
  color: string;
  expanded: boolean;
  activeIsAnalyzed: boolean;
  activeVerdict: string;
  verdictBg: string;
  confidence: number;
  activeReason: string | undefined;
}) {
  return (
    <>
      <p className="block text-[13px] font-semibold leading-snug line-clamp-2 text-white transition-colors">
        {story.headline}
      </p>

      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <SourceBadgeIcon source={story.source} />
          {timeAgo && <span>{timeAgo}</span>}
          {duplicates.length > 0 && (
            <DupeToggleButton
              count={duplicates.length}
              color={dupeBadgeColor}
              expanded={showDuplicates}
              onToggle={() => setShowDuplicates((v) => !v)}
              compact={false}
            />
          )}
        </div>
        <NavArrowIcon hovered={hovered} sourceColor={sourceColor} />
      </div>

      <NewsCardAiPanel
        hovered={expanded}
        color={color}
        activeIsAnalyzed={activeIsAnalyzed}
        activeVerdict={activeVerdict}
        verdictBg={verdictBg}
        confidence={confidence}
        activeReason={activeReason}
      />
    </>
  );
}

export default function NewsCard({
  story,
  isAnalyzed = false,
  pinned = false,
  compact = process.env.NEXT_PUBLIC_UI_MODE === "compact",
}: {
  story: ClassifiedStory;
  isAnalyzed?: boolean;
  pinned?: boolean;
  compact?: boolean;
}) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const innerHoveredRef = useRef(false);
  const duplicates = story.duplicates ?? [];

  useEffect(() => {
    return () => {
      if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pinned && !innerHoveredRef.current) {
      setExpanded(false);
    }
  }, [pinned]);

  const handleMouseEnter = () => {
    innerHoveredRef.current = true;
    setHovered(true);
    if (expandTimerRef.current) clearTimeout(expandTimerRef.current);
    expandTimerRef.current = setTimeout(() => {
      setExpanded(true);
      expandTimerRef.current = null;
    }, HOVER_EXPAND_DELAY * 1_000);
  };

  const handleMouseLeave = () => {
    innerHoveredRef.current = false;
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
    setHovered(false);
    if (pinned) return;
    setExpanded(false);
  };

  const activeVerdict = story.verdict ?? "";
  const activeConfidence = story.confidence;
  const activeReason = story.reason;
  const activeIsAnalyzed = isAnalyzed;

  const color = VERDICT_COLOR[activeVerdict] ?? "#64748b";
  const verdictBg = VERDICT_BG[activeVerdict] ?? "rgba(100,116,139,0.08)";
  const verdictPillBg =
    VERDICT_PILL_BG[activeVerdict] ?? "rgba(100,116,139,0.12)";
  const confidence = Math.round((activeConfidence ?? 0) * 100);

  const timeAgo = formatTimeAgo(story.datetime);
  const sourceColor = getSourceColor(story.source);
  const dupeBadgeColor = duplicates.length > 0
    ? getSourceColor(duplicates[0].source)
    : sourceColor;

  return (
    <GlassView
      layout
      layoutId={id}
      interactive
      cornerRadius={CARD_RADIUS}
      className="relative cursor-pointer group/item rounded-[8px]"
      style={{ color }}
      onClick={() => window.open(story.url, "_blank")}
    >
      <div
        className={compact ? "px-[7px] py-[5px] relative" : "p-2 relative"}
        data-hovered={hovered ? "true" : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Corner brackets */}
        <span className="news-cap news-cap-top-left" />
        <span className="news-cap news-cap-top-right" />
        <span className="news-cap news-cap-bottom-left" />
        <span className="news-cap news-cap-bottom-right" />

        {/* Animated edge fills */}
        <motion.span
          className="news-edge news-edge-top"
          initial={false}
          animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0.4 }}
          transition={{ duration: hovered ? HOVER_EXPAND_DELAY : 0.2, ease: "linear" }}
        />
        <motion.span
          className="news-edge news-edge-bottom"
          initial={false}
          animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0.4 }}
          transition={{ duration: hovered ? HOVER_EXPAND_DELAY : 0.2, ease: "linear" }}
        />

        <div className="relative" style={{ zIndex: 2 }}>
          {compact ? (
            <CompactCardContent
              story={story}
              timeAgo={timeAgo}
              duplicates={duplicates}
              dupeBadgeColor={dupeBadgeColor}
              showDuplicates={showDuplicates}
              setShowDuplicates={setShowDuplicates}
              hovered={hovered}
              sourceColor={sourceColor}
              color={color}
              expanded={expanded}
              activeIsAnalyzed={activeIsAnalyzed}
              activeVerdict={activeVerdict}
              verdictBg={verdictBg}
              confidence={confidence}
              activeReason={activeReason}
            />
          ) : (
            <DefaultCardContent
              story={story}
              timeAgo={timeAgo}
              duplicates={duplicates}
              dupeBadgeColor={dupeBadgeColor}
              showDuplicates={showDuplicates}
              setShowDuplicates={setShowDuplicates}
              hovered={hovered}
              sourceColor={sourceColor}
              color={color}
              expanded={expanded}
              activeIsAnalyzed={activeIsAnalyzed}
              activeVerdict={activeVerdict}
              verdictBg={verdictBg}
              confidence={confidence}
              activeReason={activeReason}
            />
          )}

          <DuplicateList duplicates={duplicates} compact={compact} />
        </div>
      </div>
    </GlassView>
  );
}
