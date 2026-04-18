"use client";

import { useRef, useEffect, useState } from "react";
import VerdictBadge from "@/components/VerdictBadge";
import type { CountryState, GeoStory } from "@/types/geo.types";

// ---------------------------------------------------------------------------
// Country name + emoji flag by ISO alpha-2 code
// ---------------------------------------------------------------------------

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CN: "China", TW: "Taiwan", KR: "South Korea",
  JP: "Japan", DE: "Germany", NL: "Netherlands", FR: "France",
  GB: "United Kingdom", IL: "Israel", CA: "Canada", AU: "Australia",
  IN: "India", CH: "Switzerland", SE: "Sweden", DK: "Denmark",
  NO: "Norway", FI: "Finland", BE: "Belgium", ES: "Spain",
  IT: "Italy", IE: "Ireland", SG: "Singapore", HK: "Hong Kong",
  BR: "Brazil", MX: "Mexico", RU: "Russia", SA: "Saudi Arabia",
  AE: "UAE", ZA: "South Africa", NZ: "New Zealand", ID: "Indonesia",
  MY: "Malaysia", TH: "Thailand", VN: "Vietnam", PH: "Philippines",
  PT: "Portugal", AT: "Austria", LU: "Luxembourg",
};

function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
    .join("");
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Story row
// ---------------------------------------------------------------------------

function StoryRow({ story }: { story: GeoStory }) {
  const verdictColors: Record<string, string> = {
    BUY: "#00FF88",
    SELL: "#FF4444",
    HOLD: "#64748b",
  };
  const color = verdictColors[story.verdict] ?? "#64748b";
  const confidence = Math.round(story.confidence * 100);

  return (
    <div
      style={{ borderLeft: `2px solid ${color}`, paddingLeft: 10, paddingBottom: 2 }}
      className="flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color, letterSpacing: "0.05em" }}>
            {story.verdict}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#475569" }}>
            {story.ticker}
          </span>
          {story.relevanceScore >= 0.7 && (
            <span style={{ fontSize: 9, color: "#00FF88" }}>● HI-REL</span>
          )}
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color, opacity: 0.9 }}>
          {confidence}%
        </span>
      </div>
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 12,
          color: "#94a3b8",
          margin: 0,
          lineHeight: 1.4,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {story.headline}
      </p>
      <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden mt-0.5">
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${confidence}%`, background: color }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CountryTooltipProps {
  state: CountryState;
  mouseX: number;
  mouseY: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CountryTooltip({ state, mouseX, mouseY }: CountryTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: mouseX, y: mouseY });

  // Clamp position so tooltip never goes off screen
  useEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 16;
    const x = Math.min(mouseX + 14, vw - w - padding);
    const y = Math.min(mouseY - 10, vh - h - padding);
    setPos({ x: Math.max(padding, x), y: Math.max(padding, y) });
  }, [mouseX, mouseY]);

  const countryName = COUNTRY_NAMES[state.countryCode] ?? state.countryCode;
  const flag = flagEmoji(state.countryCode);
  const stories = state.stories.slice(0, 5);

  return (
    <div
      ref={tooltipRef}
      className="absolute z-50 pointer-events-none"
      style={{ left: pos.x, top: pos.y, maxWidth: 380 }}
    >
      {/* Glass card */}
      <div
        style={{
          background: "rgba(14, 20, 14, 0.88)",
          backdropFilter: "blur(20px) saturate(160%)",
          WebkitBackdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid rgba(0,255,136,0.15)",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,255,136,0.04)",
          padding: "16px 18px",
          minWidth: 280,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 22 }}>{flag}</span>
            <div>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, color: "#e2e8f0", margin: 0 }}>
                {countryName}
              </p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#64748b", margin: 0 }}>
                {state.countryCode}
              </p>
            </div>
          </div>
          {state.netVerdict && (
            <VerdictBadge verdict={state.netVerdict} confidence={Math.abs(state.netScore)} />
          )}
        </div>

        {/* HQ info */}
        {state.isHQCountry && state.hqTickers.length > 0 && (
          <div
            style={{
              background: "rgba(0,255,136,0.05)",
              border: "1px solid rgba(0,255,136,0.1)",
              borderRadius: 8,
              padding: "8px 10px",
              marginBottom: 12,
            }}
          >
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#00FF88", margin: 0 }}>
              HQ: {state.hqTickers.join(" · ")}
            </p>
            {state.totalPositionValue > 0 && (
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>
                Position: {formatMoney(state.totalPositionValue)}
              </p>
            )}
          </div>
        )}

        {/* Stories */}
        {stories.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {stories.map((story) => (
              <StoryRow
                key={`${story.ticker}-${story.source}-${story.datetime}-${story.url}`}
                story={story}
              />
            ))}
            {state.stories.length > 5 && (
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#475569", margin: 0, textAlign: "center" }}>
                +{state.stories.length - 5} more stories
              </p>
            )}
          </div>
        ) : (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "#475569", margin: 0 }}>
            HQ location — no news stories yet
          </p>
        )}
      </div>
    </div>
  );
}
