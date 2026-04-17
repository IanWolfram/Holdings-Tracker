"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Props {
  badge: React.ReactNode;
  count: number;
  defaultExpanded?: boolean;
  fullyCollapsible?: boolean;
  children: React.ReactNode[];
}

export default function NewsCollapsible({
  badge,
  count,
  defaultExpanded = false,
  fullyCollapsible = false,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded || (!fullyCollapsible && count <= 1));

  if (count === 0) return null;

  const showGhost1 = !expanded && count >= 2 && !fullyCollapsible;
  const showGhost2 = !expanded && count >= 3 && !fullyCollapsible;

  return (
    <div>
      {/* Header — always at top */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-white/[0.03] transition-colors group/hdr"
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {badge}
        </div>
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

      {/* Top Card & Ghosts (Only if not fullyCollapsible) */}
      {!fullyCollapsible && (
        <div
          className="relative"
          style={{ paddingBottom: showGhost2 ? 13 : showGhost1 ? 7 : 0 }}
        >
          <div 
            className={!expanded ? "cursor-pointer" : ""} 
            style={{ zIndex: 10, position: "relative" }}
            onClick={() => { if (!expanded) setExpanded(true); }}
          >
            {children[0]}
          </div>

          <AnimatePresence>
            {showGhost1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.65 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute left-[4%] right-[4%] rounded-[8px] border border-white/[0.08] bg-[#0d0f11] pointer-events-none"
                style={{ bottom: showGhost2 ? 7 : 0, height: 13, zIndex: 2 }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showGhost2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute left-[8%] right-[8%] rounded-[8px] border border-white/[0.05] bg-[#0a0c0e] pointer-events-none"
                style={{ bottom: 0, height: 13, zIndex: 1 }}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Expanded: animated rest of card list (or ALL if fullyCollapsible) */}
      <AnimatePresence initial={false}>
        {expanded && (fullyCollapsible || children.length > 1) && (
          <motion.div
            key="list"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden"
          >
            <div className={`space-y-2 ${fullyCollapsible ? "pt-1" : "pt-2"}`}>
              {fullyCollapsible ? children : children.slice(1)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
