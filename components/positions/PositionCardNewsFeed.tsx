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

// Shared spring for the expand/collapse choreography. The open stack and every
// pushed sibling animate on the SAME spring so the growing stack's edge and the
// neighbours it shoves move in lockstep — reads as one physical interaction.
const STACK_SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;

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
  // Which stack ("pending" | "congress" | "analyzed") is open. Like the
  // prediction panel, an open stack overlays the grey news region instead of
  // expanding inline — the collapsed previews stay mounted underneath so the
  // card height never changes regardless of what is open.
  const [openStack, setOpenStack] = useState<string | null>(null);

  // The news region stays a fixed-height flex-1 box across the whole toggle —
  // NEVER swapped to a pixel height. That stability is what lets the open
  // stack's grow + its siblings' shove animate on one Framer `layout` spring.
  // The open stack can't feed height back into the card because its scroll list
  // is absolutely positioned (see ExpandedStack) — it contributes ~0 intrinsic
  // height, so the grid-row / card height never grows when a stack opens.
  const openStackPanel = (key: string) => {
    setOpenStack(key);
    setShowPredictions(false);
  };
  const closeStack = () => {
    setOpenStack(null);
  };
  const togglePredictions = (next: boolean) => {
    setShowPredictions(next);
    if (next) {
      setOpenStack(null);
    }
  };

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

  // Each stack is defined once: its badge + the full card list are reused by
  // the collapsed preview (NewsCollapsible renders the top card) and by the
  // open-stack overlay (which renders the whole list, scrolling internally).
  type StackVariant = "default" | "pending" | "queued" | "congress";
  interface StackDef {
    key: string;
    badge: React.ReactNode;
    count: number;
    stackVariant?: StackVariant;
    cards: React.ReactNode[];
  }
  const stacks: StackDef[] = [];

  if (pendingStories.length > 0) {
    stacks.push({
      key: "pending",
      count: pendingStories.length,
      stackVariant:
        agentState?.status === "running" && agentState?.ticker === ticker
          ? "queued"
          : "pending",
      badge: (
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
      ),
      cards: pendingStories.map((story) => (
        <PendingNewsCard
          key={`${story.ticker}-${story.source}-${story.datetime}-${story.headline}`}
          story={story}
          agentState={agentState}
        />
      )),
    });
  }

  if (congressTrades.length > 0) {
    stacks.push({
      key: "congress",
      count: recentCongressTrades.length,
      stackVariant: "congress",
      badge: <CongressHeader />,
      cards: recentCongressTrades.map((trade) => (
        <CongressTradeCard key={trade.id} trade={trade} />
      )),
    });
  }

  if (analyzedStories.length > 0) {
    stacks.push({
      key: "analyzed",
      count: analyzedStories.length,
      badge: (
        <span className="flex items-center gap-1.5">
          {analyzedSources.map((source) => (
            <SourceBadge key={source} source={source} iconOnly />
          ))}
        </span>
      ),
      cards: analyzedStories.map((story) => (
        <NewsCard
          key={`${story.ticker}-${story.source}-${story.datetime}-${story.url}`}
          story={story}
        />
      )),
    });
  }

  return (
    <>
      <PredictionStrip
        allPredictions={allPredictions ?? []}
        correctCount={resolvedStats?.correct ?? 0}
        compact={compact}
        open={showPredictions}
        onToggle={togglePredictions}
      />
      {/* News region — fixed height (the card is sized via items-stretch to the
          tallest card in its row). Stacks live INLINE in a flex column: opening
          one makes it flex-1 (it grows into the slack below the previews) while
          its siblings translate to their new positions on the same spring, so
          the open stack visibly shoves its neighbours away. Because exactly one
          child grows inside a fixed-height container, the sum — and therefore
          the card height — never changes. The prediction panel still overlays
          (it's a full-region swap, not a stack-among-stacks). */}
      <div className="relative overflow-hidden flex-1 min-h-0">
        <div className={`h-full ${showPredictions ? "invisible" : ""}`} aria-hidden={showPredictions || undefined}>
        <GlassContainer className={`h-full ${compact ? "p-2 pb-6" : "p-3 pb-7"} border-t border-white/[0.05]`}>
          <div className="flex flex-col overflow-x-hidden h-full">
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
            <div className={`flex flex-col h-full min-h-0 ${openStack !== null ? "gap-0" : compact ? "gap-2" : "gap-3"}`}>
              {stacks.map((s) => {
                const isOpen = openStack === s.key;
                // A peer = a stack while a DIFFERENT one is open. The open stack
                // takes over the WHOLE region; peers collapse out of view (height
                // 0, clipped) on the same spring — they slide away and the expanded
                // stack grows into the space they vacated. Collapse (glass arrows)
                // brings them back.
                const isPeer = openStack !== null && !isOpen;
                return (
                  <motion.div
                    key={s.key}
                    // One shared `layout` spring drives the push: the open stack
                    // grows to fill the region while peers collapse to nothing and
                    // get shoved out of view. Must stay a CONSTANT `layout` (not
                    // toggled per open state) — flipping the prop at open time
                    // resets Framer's projection and the grow snaps instead of
                    // animating.
                    layout
                    // Only animate layout on open/close — not when an SWR poll
                    // changes a collapsed preview's height (which would jiggle).
                    layoutDependency={openStack}
                    transition={STACK_SPRING}
                    // Open: flex-1 (basis 0) fills the region, bounded — flex-initial
                    // leaks content height up the (min-height:auto) flex chain and
                    // blows the card up. Peer: height 0 + overflow-hidden so it
                    // vacates the region entirely. Closed (nothing open): preview.
                    className={
                      isOpen
                        ? "flex-1 min-h-0"
                        : isPeer
                          ? "flex-none h-0 overflow-hidden"
                          : "flex-none"
                    }
                  >
                    {isOpen ? (
                      <ExpandedStack
                        badge={s.badge}
                        cards={s.cards}
                        compact={compact}
                        onClose={closeStack}
                      />
                    ) : (
                      <NewsCollapsible
                        badge={s.badge}
                        count={s.count}
                        stackVariant={s.stackVariant}
                        onOpen={() => openStackPanel(s.key)}
                      >
                        {s.cards}
                      </NewsCollapsible>
                    )}
                  </motion.div>
                );
              })}
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

// Inline expanded stack — no panel/backdrop of its own. The scroll container is
// ABSOLUTELY positioned (inset-0): it contributes ~0 intrinsic height, so the
// card never grows from the open stack's content (the grid stretches every card
// in a row to the tallest, so in-flow cards here would balloon the whole row).
// INSIDE it, the cards flow normally between two STICKY translucent glass bars —
// cards slide *behind* the frosted glass as they scroll, and when they don't
// overflow the bottom bar simply hugs the last card instead of floating below a
// dead gap (the original bug).
function ExpandedStack({
  badge,
  cards,
  compact,
  onClose,
}: {
  badge: React.ReactNode;
  cards: React.ReactNode[];
  compact: boolean;
  onClose: () => void;
}) {
  // Frosted glass — strong blur + a mostly-opaque dark tint so news cards
  // scrolling behind the bars dissolve into a soft blur instead of staying
  // legible. Kept just translucent enough to read as glass, not a solid bar.
  const barStyle: React.CSSProperties = {
    backdropFilter: "blur(30px) saturate(140%)",
    WebkitBackdropFilter: "blur(30px) saturate(140%)",
    background:
      "linear-gradient(to bottom, rgba(20,20,26,0.82) 0%, rgba(20,20,26,0.7) 100%)",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative h-full min-h-0"
    >
      <div
        className="absolute inset-0 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
        {/* Top translucent glass bar — sticks to the top; cards scroll behind it.
            `layout` keeps it scale-corrected during the parent's grow. MUST sit
            above the cards (z-30): NewsCard's physics-border layer is itself
            z-10, so a z-10 bar tied with it and the later-in-DOM cards painted
            ON TOP — the backdrop-filter/tint then had nothing in front to frost
            and the header looked see-through. z-30 wins the stack so the frost
            (blur + dark tint in barStyle) actually applies to scrolled cards. */}
        <motion.button
          layout
          onClick={onClose}
          aria-label="Collapse stack"
          className="sticky top-0 z-30 w-full h-7 px-2.5 flex items-center justify-between gap-2 group/col transition-colors hover:bg-white/[0.05] rounded-t-[8px]"
          style={{ ...barStyle, boxShadow: "inset 0 -1px 0 0 rgba(255,255,255,0.06)" }}
        >
          <span className="flex items-center gap-1.5 min-w-0">{badge}</span>
          <span className="material-symbols-outlined text-[16px] text-slate-500 group-hover/col:text-slate-300 transition-colors shrink-0">
            expand_less
          </span>
        </motion.button>

        <div className={`space-y-2 py-2 ${compact ? "px-1" : "px-1.5"}`}>{cards}</div>

        {/* Bottom translucent glass bar — sticks to the bottom; cards scroll behind. */}
        <motion.button
          layout
          onClick={onClose}
          aria-label="Collapse stack"
          className="sticky bottom-0 z-30 w-full h-7 px-2.5 flex items-center justify-center group/col2 transition-colors hover:bg-white/[0.05] rounded-b-[8px]"
          style={{ ...barStyle, boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06)" }}
        >
          <span className="material-symbols-outlined text-[16px] text-slate-500 group-hover/col2:text-slate-300 transition-colors">
            expand_more
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
}