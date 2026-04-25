import { AnimatePresence, motion } from "framer-motion";
import { REVEAL_EASE } from "@/lib/utils/newsCardAnimations";

interface NewsCardAiPanelProps {
  hovered: boolean;
  color: string;
  activeIsAnalyzed: boolean;
  activeVerdict: string;
  verdictBg: string;
  confidence: number;
  activeReason?: string;
}

export default function NewsCardAiPanel({
  hovered,
  color,
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
            <div
              className="rounded-[4px] p-2"
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
                      M5 VERIFIED
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
