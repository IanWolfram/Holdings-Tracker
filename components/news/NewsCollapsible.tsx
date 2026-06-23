"use client";

import { cloneElement, isValidElement, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Ghost slabs are full-card-height so when they fan out on hover they stay
// continuously overlapped — gaps between thin slivers turn into a smooth
// reveal of "real" news cards tucked behind the top one.
const GHOST_HEIGHT = 60;
// How far the fan-out animation is allowed to extend below the wrapper
// (kept generous so the motion isn't clipped). The clipper wrapper sits
// exactly at the top card's bottom edge, so ghosts never bleed through.
const STACK_FAN_REVEAL = 24;

type StackVariant = "default" | "pending" | "queued" | "congress";

interface Props {
  badge: React.ReactNode;
  icon?: React.ReactNode;
  count: number;
  defaultExpanded?: boolean;
  fullyCollapsible?: boolean;
  /** Tints the bottom ghost stack to match the visible top card variant
   *  (e.g. `pending` for `Run Agent` cards, `queued` for `In Queue` cards). */
  stackVariant?: StackVariant;
  /** Click handler for the stack. When provided (PositionCard feed), opening is
   *  delegated to the parent, which renders the full list as an overlay so the
   *  card height never changes. When omitted, falls back to internal expand. */
  onOpen?: () => void;
  children: React.ReactNode[];
}

const STACK_VARIANT_CLASS: Record<StackVariant, string> = {
  default: "",
  pending: "glass-edge-pending",
  queued: "glass-edge-queued",
  congress: "glass-edge-congress",
};

export default function NewsCollapsible({
  badge,
  icon,
  count,
  defaultExpanded = false,
  fullyCollapsible = false,
  stackVariant = "default",
  onOpen,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(
    defaultExpanded,
  );
  // Tracks whether cursor is anywhere within the combined card + stack area.
  // Passed as `pinned` to children[0] so the top news card's AI panel doesn't
  // collapse the moment the user moves down toward the stack hit zone.
  const [wrapperHovered, setWrapperHovered] = useState(false);

  const handleWrapperMouseEnter = () => setWrapperHovered(true);
  const handleWrapperMouseLeave = () => setWrapperHovered(false);

  const stackRef = useRef<HTMLDivElement>(null);
  const hoverProgress = useMotionValue(0);
  const springProgress = useSpring(hoverProgress, {
    stiffness: 220,
    damping: 26,
    restDelta: 0.001,
  });

  // Ghost translate-down values driven by cursor proximity to bottom of stack.
  // Declared unconditionally to satisfy Rules of Hooks.
  const ghost1Y = useTransform(springProgress, [0, 1], [0, 5]);
  const ghost2Y = useTransform(springProgress, [0, 1], [0, 10]);
  const ghost3Y = useTransform(springProgress, [0, 1], [0, 14]);

  if (count === 0) return null;

  // Fully-collapsible mode (used in WorldSidebar) keeps a header — the only
  // affordance, since no top card is rendered when collapsed.
  if (fullyCollapsible) {
    return (
      <div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-2 px-1 py-0.5 rounded-md hover:bg-white/[0.03] transition-colors group/hdr"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">{badge}</div>
          {icon && <span className="shrink-0 text-slate-500">{icon}</span>}
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-sm bg-white/[0.06] text-slate-500 tabular-nums shrink-0">
            {count}
          </span>
          <span
            className={`material-symbols-outlined text-[14px] text-slate-600 group-hover/hdr:text-slate-400 transition-transform duration-300 shrink-0 ${
              expanded ? "rotate-180" : ""
            }`}
          >
            expand_more
          </span>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="list"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.32, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-1">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const showGhost1 = !expanded && count >= 2;
  const showGhost2 = !expanded && count >= 3;
  const showGhost3 = !expanded && count >= 4;
  const hasStack = count >= 2;

  const baseStackPad = showGhost3 ? 21 : showGhost2 ? 14 : showGhost1 ? 7 : 0;

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = stackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const progress = Math.max(
      0,
      Math.min(1, (e.clientY - rect.top) / rect.height),
    );
    hoverProgress.set(progress);
  };

  const handleMouseLeave = () => {
    hoverProgress.set(0);
  };

  return (
    <div>
      <div
        className="relative"
        style={{ paddingBottom: expanded ? 0 : baseStackPad }}
        onMouseEnter={handleWrapperMouseEnter}
        onMouseLeave={handleWrapperMouseLeave}
      >
        {/* Top card only shown when collapsed — expands into the scrollbox.
            Cloned with `pinned` so its AI panel stays expanded while the cursor
            is anywhere in the wrapper (including the bottom stack hit zone). */}
        {!expanded && (
          <div style={{ zIndex: 10, position: "relative" }}>
            {isValidElement(children[0])
              ? cloneElement(
                  children[0] as React.ReactElement<{ pinned?: boolean }>,
                  { pinned: wrapperHovered },
                )
              : children[0]}
          </div>
        )}

        {/* Ghost stack — sits BEHIND the top card and is clipped by the wrapper
            below so the part of each slab that extends up into the top card
            area never bleeds through the top card's glass. The clipper top
            edge sits flush with the top card's bottom edge (height ===
            baseStackPad + STACK_FAN_REVEAL); the extra `STACK_FAN_REVEAL`
            below the wrapper bottom keeps the fan-out animation uncut. */}
        <div
          className="absolute left-0 right-0 overflow-hidden pointer-events-none"
          style={{
            bottom: -STACK_FAN_REVEAL,
            height: baseStackPad + STACK_FAN_REVEAL,
          }}
        >
          <AnimatePresence>
            {showGhost1 && (
              <motion.div
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.22 }}
                className={`absolute left-[4%] right-[4%] rounded-[8px] glass-edge glass-edge-opaque ${STACK_VARIANT_CLASS[stackVariant]} pointer-events-none`}
                style={{
                  bottom: STACK_FAN_REVEAL + (showGhost3 ? 14 : showGhost2 ? 7 : 0),
                  height: GHOST_HEIGHT,
                  zIndex: 3,
                  y: ghost1Y,
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showGhost2 && (
              <motion.div
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 0.7 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.22, delay: 0.04 }}
                className={`absolute left-[8%] right-[8%] rounded-[8px] glass-edge glass-edge-opaque ${STACK_VARIANT_CLASS[stackVariant]} pointer-events-none`}
                style={{
                  bottom: STACK_FAN_REVEAL + (showGhost3 ? 7 : 0),
                  height: GHOST_HEIGHT,
                  zIndex: 2,
                  y: ghost2Y,
                }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showGhost3 && (
              <motion.div
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 0.45 }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.22, delay: 0.08 }}
                className={`absolute left-[12%] right-[12%] rounded-[8px] glass-edge glass-edge-opaque ${STACK_VARIANT_CLASS[stackVariant]} pointer-events-none`}
                style={{
                  bottom: STACK_FAN_REVEAL,
                  height: GHOST_HEIGHT,
                  zIndex: 1,
                  y: ghost3Y,
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Hit zone — confined to the paddingBottom area + a small extension
            below. Sized so the top edge of the zone meets the bottom edge of
            the top card exactly (no overlap, top card stays clickable). */}
        {hasStack && !expanded && (
          <div
            ref={stackRef}
            role="button"
            tabIndex={0}
            aria-label={`Expand ${count} stories`}
            onClick={() => onOpen?.()}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen?.();
              }
            }}
            className="absolute left-0 right-0 cursor-pointer"
            style={{
              bottom: -8,
              height: baseStackPad + 8,
              zIndex: 30,
            }}
          />
        )}
      </div>
    </div>
  );
}
