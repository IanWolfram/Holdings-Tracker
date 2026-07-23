"use client";

import { useRef } from "react";
import type { CompanyProfile } from "@/types/geo.types";

interface Props {
  hoveredTicker: string | null;
  /** Every ticker stacked at the hovered marker's location (includes hoveredTicker). */
  coLocatedTickers?: string[];
  profile: CompanyProfile | null;
  focusedTicker?: string | null;
}

export default function CubeHoverLabel({ hoveredTicker, coLocatedTickers, focusedTicker }: Props) {
  const lastTickersRef = useRef<string[] | null>(null);

  const activeTicker = hoveredTicker ?? focusedTicker;

  // When hovering, render one label per co-located ticker; when only focused,
  // render the single focused ticker.
  const activeTickers: string[] | null = hoveredTicker
    ? (coLocatedTickers && coLocatedTickers.length > 0 ? coLocatedTickers : [hoveredTicker])
    : activeTicker
    ? [activeTicker]
    : null;

  if (activeTickers) {
    lastTickersRef.current = activeTickers;
  }

  const displayTickers = activeTickers ?? lastTickersRef.current;

  if (!displayTickers || displayTickers.length === 0) return null;

  // Each label is its own fixed element positioned imperatively by the globe
  // animation loop (see animation.ts) so it sits above its own octahedron.
  return (
    <>
      {displayTickers.map((ticker) => (
        <div
          key={ticker}
          id={`marker-hover-label-${ticker}`}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            opacity: 0,
            pointerEvents: "none",
            zIndex: 45,
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
            {ticker}
          </span>
        </div>
      ))}
    </>
  );
}
