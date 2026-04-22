import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { REVEAL_EASE } from "@/lib/utils/newsCardAnimations";

interface NewsCardAiPanelProps {
  hovered: boolean;
  analyzing: boolean;
  analyzeHovered: boolean;
  onAnalyzeEnter: () => void;
  onAnalyzeLeave: () => void;
  onAnalyzeClick: (event: React.MouseEvent) => Promise<void>;
  color: string;
  canAnalyze: boolean;
  deepAnalysis: unknown;
  activeIsAnalyzed: boolean;
  activeVerdict: string;
  verdictBg: string;
  confidence: number;
  activeReason?: string;
}

export default function NewsCardAiPanel({
  hovered,
  analyzing,
  analyzeHovered,
  onAnalyzeEnter,
  onAnalyzeLeave,
  onAnalyzeClick,
  color,
  canAnalyze,
  deepAnalysis,
  activeIsAnalyzed,
  activeVerdict,
  verdictBg,
  confidence,
  activeReason,
}: NewsCardAiPanelProps) {
  return (
    <AnimatePresence initial={false}>
      {hovered && (
        <motion.div
          key="ai"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: REVEAL_EASE }}
          className="overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mt-2">
            <motion.div
              className="overflow-hidden rounded-t-[4px] cursor-pointer select-none"
              animate={{ height: analyzeHovered ? 36 : 5 }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              style={{
                background: analyzeHovered ? `${color}18` : `${color}0d`,
                borderTop: `1px solid ${color}${analyzeHovered ? "60" : "35"}`,
                borderLeft: `1px solid ${color}${analyzeHovered ? "60" : "35"}`,
                borderRight: `1px solid ${color}${analyzeHovered ? "60" : "35"}`,
                transition: "background 0.18s, border-color 0.18s",
              }}
              onMouseEnter={onAnalyzeEnter}
              onMouseLeave={onAnalyzeLeave}
              onClick={onAnalyzeClick}
            >
              <AnimatePresence mode="wait">
                {analyzing ? (
                  <motion.div
                    key="scanning"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-3 h-9"
                  >
                    <motion.div
                      className="w-2.5 h-2.5 rounded-full border-[1.5px] shrink-0"
                      style={{ borderColor: `${color}40`, borderTopColor: color }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}
                    />
                    <span className="font-mono text-[8px] font-black tracking-widest uppercase" style={{ color }}>
                      scanning
                    </span>
                  </motion.div>
                ) : analyzeHovered ? (
                  <motion.div
                    key="label"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15, ease: REVEAL_EASE }}
                    className="flex items-center justify-between px-3 h-9"
                  >
                    <span
                      className="font-mono text-[9px] font-black tracking-[0.22em] uppercase"
                      style={{ color: canAnalyze ? color : "#475569" }}
                    >
                      {deepAnalysis ? "ANALYZED" : "DEEP ANALYSIS"}
                    </span>
                    <motion.svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4 shrink-0 overflow-visible"
                      animate={canAnalyze ? { x: [0, 3, 0] } : {}}
                      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <path
                        d="M 4 12 H 20 M 14 6 L 20 12 L 14 18"
                        fill="none"
                        stroke={canAnalyze ? color : "#475569"}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: canAnalyze ? `drop-shadow(0 0 3px ${color})` : "none" }}
                      />
                    </motion.svg>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>

            <div
              className="rounded-b-[4px] p-2"
              style={{
                background: "rgba(10,12,18,0.7)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderTop: `1px solid ${color}20`,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    AI Analysis
                  </span>
                  {activeIsAnalyzed && (
                    <span className="text-[8px] font-black bg-white/10 text-white px-1 rounded-[2px] tracking-tighter">
                      {deepAnalysis ? "DEEP SCAN" : "M5 VERIFIED"}
                    </span>
                  )}
                </div>
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: verdictBg, color }}
                >
                  {activeVerdict}
                </span>
              </div>

              <div className="mb-1.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] text-slate-500">Confidence</span>
                  <span className="font-mono text-[9px]" style={{ color }}>
                    {confidence}%
                  </span>
                </div>
                <div className="h-0.5 w-full rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${confidence}%` }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </div>
              </div>

              {activeReason ? (
                <p className="text-[10px] text-slate-400 leading-snug">{activeReason}</p>
              ) : (
                <p className="text-[10px] text-slate-600 italic">No reasoning provided</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
