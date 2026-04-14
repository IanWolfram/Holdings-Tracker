"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Props {
  badge: React.ReactNode;
  count: number;
  defaultExpanded?: boolean;
  children: React.ReactNode[];
}

export default function NewsCollapsible({
  badge,
  count,
  defaultExpanded = false,
  children,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded || count <= 1);

  if (count === 0) return null;

  const showGhost1 = !expanded && count >= 2;
  const showGhost2 = !expanded && count >= 3;

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

      {/* Collapsed: top card + ghost depth strips */}
      {!expanded && (
        <div
          className="relative cursor-pointer"
          style={{ paddingBottom: showGhost2 ? 13 : showGhost1 ? 7 : 0 }}
          onClick={() => setExpanded(true)}
        >
          <div className="relative" style={{ zIndex: 10 }}>
            {children[0]}
          </div>

          {showGhost1 && (
            <div
              className="absolute left-[4%] right-[4%] rounded-[8px] border border-white/[0.08] bg-[#0d0f11]"
              style={{ bottom: showGhost2 ? 7 : 0, height: 13, zIndex: 2, opacity: 0.65 }}
            />
          )}

          {showGhost2 && (
            <div
              className="absolute left-[8%] right-[8%] rounded-[8px] border border-white/[0.05] bg-[#0a0c0e]"
              style={{ bottom: 0, height: 13, zIndex: 1, opacity: 0.4 }}
            />
          )}
        </div>
      )}

      {/* Expanded: animated card list */}
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
            <div className="space-y-2 pt-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
