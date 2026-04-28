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

interface Props {
  badge: React.ReactNode;
  icon?: React.ReactNode;
  count: number;
  defaultExpanded?: boolean;
  fullyCollapsible?: boolean;
  children: React.ReactNode[];
}

export default function NewsCollapsible({
  badge,
  icon,
  count,
  defaultExpanded = false,
  fullyCollapsible = false,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(
    defaultExpanded || (!fullyCollapsible && count <= 1),
  );
  // Tracks whether cursor is anywhere within the combined card + stack area.
  // Passed as `pinned` to children[0] so the top news card's AI panel doesn't
  // collapse the moment the user moves down toward the stack hit zone.
  const [wrapperHovered, setWrapperHovered] = useState(false);

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
        onMouseEnter={() => setWrapperHovered(true)}
        onMouseLeave={() => setWrapperHovered(false)}
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

        {/* Ghost stack — sits BEHIND the top card. translateY shifts on hover
            create a fan-out reveal. Static padding is preserved so layout
            doesn't jitter while the ghosts move. */}
        <AnimatePresence>
          {showGhost1 && (
            <motion.div
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.22 }}
              className="absolute left-[4%] right-[4%] rounded-[8px] glass-edge pointer-events-none"
              style={{
                bottom: showGhost3 ? 14 : showGhost2 ? 7 : 0,
                height: 18,
                zIndex: 1,
                clipPath: "inset(11px 0 0 0)",
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
              className="absolute left-[8%] right-[8%] rounded-[8px] glass-edge pointer-events-none"
              style={{
                bottom: showGhost3 ? 7 : 0,
                height: 18,
                zIndex: 0,
                clipPath: "inset(11px 0 0 0)",
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
              className="absolute left-[12%] right-[12%] rounded-[8px] glass-edge pointer-events-none"
              style={{
                bottom: 0,
                height: 18,
                zIndex: 0,
                clipPath: "inset(11px 0 0 0)",
                y: ghost3Y,
              }}
            />
          )}
        </AnimatePresence>

        {/* Hit zone — confined to the paddingBottom area + a small extension
            below. Sized so the top edge of the zone meets the bottom edge of
            the top card exactly (no overlap, top card stays clickable). */}
        {hasStack && !expanded && (
          <div
            ref={stackRef}
            role="button"
            tabIndex={0}
            aria-label={`Expand ${count} stories`}
            onClick={() => setExpanded(true)}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded(true);
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

      {/* Expanded: all children in a scrollbox — 3 cards visible, rest scroll. */}
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
            <div className="relative">
              {/* Scrollbox — content fades out at the top/bottom via mask-image
                  so cards scroll away smoothly instead of being hard-cut. */}
              <div
                className="overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
                style={{
                  maxHeight: 256,
                  msOverflowStyle: "none",
                  maskImage:
                    "linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 16px), transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 16px), transparent 100%)",
                }}
              >
                <div className="space-y-2 pt-7 pb-4">{children}</div>
              </div>

              {/* Glass header — contains collapse arrow; cards fade behind it */}
              <button
                onClick={() => setExpanded(false)}
                aria-label="Collapse stack"
                className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center rounded-t-[8px] z-10 group/col transition-colors hover:bg-white/[0.04]"
                style={{
                  backdropFilter: "blur(14px) saturate(160%)",
                  WebkitBackdropFilter: "blur(14px) saturate(160%)",
                  background:
                    "linear-gradient(to bottom, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
                  boxShadow:
                    "inset 0 -1px 0 0 rgba(255,255,255,0.06)",
                }}
              >
                <span className="material-symbols-outlined text-[14px] text-slate-500 group-hover/col:text-slate-300 transition-colors">
                  expand_less
                </span>
              </button>

              {/* Glass footer — purely decorative; mirrors the header */}
              <div
                className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none rounded-b-[8px] z-10"
                style={{
                  backdropFilter: "blur(10px) saturate(160%)",
                  WebkitBackdropFilter: "blur(10px) saturate(160%)",
                  background:
                    "linear-gradient(to top, rgba(255,255,255,0.03) 0%, transparent 100%)",
                  boxShadow:
                    "inset 0 1px 0 0 rgba(255,255,255,0.05)",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
