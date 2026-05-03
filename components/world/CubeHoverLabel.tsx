"use client";

import { useRef } from "react";
import type { CompanyProfile } from "@/types/geo.types";

interface Props {
  hoveredTicker: string | null;
  profile: CompanyProfile | null;
  focusedTicker?: string | null;
}

export default function CubeHoverLabel({ hoveredTicker, profile, focusedTicker }: Props) {
  const lastTickerRef = useRef<string | null>(null);

  const activeTicker = hoveredTicker ?? focusedTicker;
  if (activeTicker) {
    lastTickerRef.current = activeTicker;
  }

  const displayTicker = activeTicker ?? lastTickerRef.current;

  if (!displayTicker) return null;

  return (
    <div
      id="marker-hover-label"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        opacity: 0,
        pointerEvents: "none",
        zIndex: 45,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        willChange: "transform, opacity",
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 900,
          color: "#ffffff",
          letterSpacing: "0.04em",
          textShadow:
            "0 1px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
        }}
      >
        {displayTicker}
      </span>
    </div>
  );
}