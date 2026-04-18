"use client";

import { motion } from "framer-motion";

interface Props {
  progress: number; // 0 to 100
  color?: string;
}

/**
 * AnalysisProgressBorder renders a tracing border that fills up based on the progress.
 * It uses SVG and Framer Motion for high-fidelity path animation.
 */
export default function AnalysisProgressBorder({ progress, color = "#00FF88" }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ margin: -0.5 }}>
      <svg
        width="100%"
        height="100%"
        className="block overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="0.5"
          y="0.5"
          width="calc(100% - 1px)"
          height="calc(100% - 1px)"
          rx="8"
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <motion.rect
          x="0.5"
          y="0.5"
          width="calc(100% - 1px)"
          height="calc(100% - 1px)"
          rx="8"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: progress / 100 }}
          transition={{ type: "spring", bounce: 0, duration: 0.8 }}
          style={{
            filter: `drop-shadow(0 0 3px ${color}66)`,
          }}
        />
      </svg>
    </div>
  );
}
