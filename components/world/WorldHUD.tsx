"use client";

import type { WorldData } from "@/types/geo.types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorldHUDProps {
  worldData: WorldData | null;
  relevanceThreshold: number;
  onRelevanceChange: (value: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WorldHUD({
  worldData,
  relevanceThreshold,
  onRelevanceChange,
}: WorldHUDProps) {
  const countryCount = worldData
    ? Object.values(worldData.countries).filter((c) => c.stories.length > 0).length
    : 0;
  const storyCount = worldData
    ? Object.values(worldData.countries).reduce((acc, c) => acc + c.stories.length, 0)
    : 0;

  const sliderPct = Math.round(relevanceThreshold * 100);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        background: "rgba(8, 12, 8, 0.85)",
        backdropFilter: "blur(20px) saturate(150%)",
        WebkitBackdropFilter: "blur(20px) saturate(150%)",
        borderTop: "1px solid rgba(0,255,136,0.1)",
        display: "flex",
        alignItems: "center",
        paddingInline: 28,
        gap: 32,
        zIndex: 40,
      }}
    >
      {/* Relevance slider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
        <span
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 12,
            color: "#64748b",
            whiteSpace: "nowrap",
          }}
        >
          Relevance
        </span>
        <div style={{ position: "relative", width: 140, display: "flex", alignItems: "center" }}>
          <input
            id="relevance-slider"
            type="range"
            min={0}
            max={100}
            step={5}
            value={sliderPct}
            onChange={(e) => onRelevanceChange(parseInt(e.target.value) / 100)}
            style={{
              width: "100%",
              accentColor: "#00FF88",
              cursor: "pointer",
              height: 4,
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: "#00FF88",
            minWidth: 36,
          }}
        >
          {sliderPct}%
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Story count */}
      {worldData && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#475569",
          }}
        >
          {storyCount} stories · {countryCount} countries
        </span>
      )}

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <LegendDot color="#00FF88" label="BUY" />
        <LegendDot color="#FF4444" label="SELL" />
        <LegendDot color="#64748b" label="HOLD" />
      </div>

      {/* Last updated */}
      {worldData && (
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#334155",
            whiteSpace: "nowrap",
          }}
        >
          Updated {formatTimestamp(worldData.fetchedAt)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend dot
// ---------------------------------------------------------------------------

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}80`,
        }}
      />
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "#64748b",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>
    </div>
  );
}
