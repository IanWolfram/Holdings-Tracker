import CountryTooltip from "@/components/world/CountryTooltip";
import type { GlobeFocusTarget } from "@/components/world/GlobeCanvas";
import CubeHoverLabel from "@/components/world/CubeHoverLabel";
import FocusPanel from "@/components/world/FocusPanel";
import type { CountryState, WorldData } from "@/types/geo.types";
import type { Position } from "@/types/position.types";
import { AnimatePresence } from "framer-motion";
import type { CSSProperties } from "react";

const LOADING_OVERLAY_STYLE: CSSProperties = {
  background: "rgba(5, 8, 5, 0.75)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  zIndex: 10,
};

const SPINNER_STYLE: CSSProperties = {
  width: 48,
  height: 48,
  border: "2px solid rgba(0,255,136,0.2)",
  borderTop: "2px solid #00FF88",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  margin: "0 auto",
};

const LOADING_TEXT_STYLE: CSSProperties = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 15,
  color: "#94a3b8",
  margin: 0,
};

const LOADING_SUBTEXT_STYLE: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  color: "#334155",
  margin: 0,
};

const FOCUS_OVERLAY_STYLE: CSSProperties = {
  background: "transparent",
};

const CONNECTOR_SVG_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  pointerEvents: "none",
  zIndex: 39,
  overflow: "visible",
};

interface WorldOverlaysProps {
  loading: boolean;
  hoveredState: CountryState | null;
  hoveredTicker: string | null;
  isFocused: boolean;
  mousePos: { x: number; y: number };
  worldData: WorldData | null;
  positions: Position[];
  focusTarget: GlobeFocusTarget;
  handleDismissFocus: () => void;
  onStockSelect: (ticker: string) => void;
  onStockHover: (ticker: string | null) => void;
  setHoveredTicker: (ticker: string | null) => void;
  stockNavIndex: number;
  countryStocks: Array<{ ticker: string }>;
}

export default function WorldOverlays({
  loading,
  hoveredState,
  hoveredTicker,
  isFocused,
  mousePos,
  worldData,
  positions,
  focusTarget,
  handleDismissFocus,
  onStockSelect,
  onStockHover,
  setHoveredTicker,
  stockNavIndex,
  countryStocks,
}: WorldOverlaysProps) {
  return (
    <>
      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={LOADING_OVERLAY_STYLE}
        >
          <div className="text-center space-y-4">
            <div
              style={SPINNER_STYLE}
            />
            <p
              style={LOADING_TEXT_STYLE}
            >
              Building world intelligence…
            </p>
            <p
              style={LOADING_SUBTEXT_STYLE}
            >
              First load: 2–3 min (cached for 15 min after)
            </p>
          </div>
        </div>
      )}

      {hoveredState && !isFocused && !hoveredTicker && (
        <CountryTooltip
          state={hoveredState}
          mouseX={mousePos.x}
          mouseY={mousePos.y}
        />
      )}

      <CubeHoverLabel
        hoveredTicker={hoveredTicker}
        profile={hoveredTicker && worldData?.profiles[hoveredTicker] ? worldData.profiles[hoveredTicker] : null}
        focusedTicker={focusTarget?.type === "stock" ? focusTarget.ticker : null}
      />

      {isFocused && (
        <div
          className="absolute inset-0 z-30 pointer-events-none"
          style={FOCUS_OVERLAY_STYLE}
        />
      )}

      {focusTarget?.type === "stock" && (
        <svg style={CONNECTOR_SVG_STYLE}>
          <defs>
            <filter id="connector-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path id="focus-connector-path" d="M -9999 -9999" stroke="rgba(0,255,136,0.38)" strokeWidth="1.5" fill="none" strokeDasharray="5 4" filter="url(#connector-glow)" />
        </svg>
      )}

      <AnimatePresence>
        {focusTarget && worldData &&
          ((focusTarget.type === "country" && worldData.countries[focusTarget.code]) ||
            (focusTarget.type === "stock" && worldData.profiles[focusTarget.ticker])) && (
            <FocusPanel
              key="focus-panel"
              focusTarget={focusTarget}
              worldData={worldData}
              positions={positions}
              onClose={handleDismissFocus}
              onStockClick={onStockSelect}
              onStockHover={onStockHover}
              stockIndex={stockNavIndex >= 0 ? stockNavIndex + 1 : undefined}
              stockCount={countryStocks.length > 1 ? countryStocks.length : undefined}
            />
          )}
      </AnimatePresence>
    </>
  );
}
