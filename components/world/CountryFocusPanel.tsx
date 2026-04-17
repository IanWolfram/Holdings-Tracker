"use client";

import { motion } from "framer-motion";
import VerdictBadge from "@/components/VerdictBadge";
import type { CountryState, GeoStory } from "@/types/geo.types";

// ---------------------------------------------------------------------------
// Country name + emoji flag helpers
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
  return code.toUpperCase().split("").map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397)).join("");
}

function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  state: CountryState;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Story row (compact)
// ---------------------------------------------------------------------------

function StoryRow({ story }: { story: GeoStory }) {
  const verdictColors: Record<string, string> = { BUY: "#00FF88", SELL: "#FF4444", HOLD: "#64748b" };
  const color = verdictColors[story.verdict] ?? "#64748b";
  const confidence = Math.round(story.confidence * 100);

  return (
    <div style={{ borderLeft: `2px solid ${color}`, paddingLeft: 8, paddingBottom: 2 }} className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, color, letterSpacing: "0.05em" }}>
            {story.verdict}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569" }}>
            {story.ticker}
          </span>
          {story.relevanceScore >= 0.7 && (
            <span style={{ fontSize: 8, color: "#00FF88" }}>● HI-REL</span>
          )}
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color, opacity: 0.85 }}>
          {confidence}%
        </span>
      </div>
      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11.5, color: "#94a3b8", margin: 0, lineHeight: 1.4 }}>
        {story.headline}
      </p>
      <div className="h-px w-full bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${confidence}%`, background: color, transition: "width 0.7s ease-out" }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CountryFocusPanel({ state, onClose }: Props) {
  const countryName = COUNTRY_NAMES[state.countryCode] ?? state.countryCode;
  const flag = flagEmoji(state.countryCode);
  const stories = [...state.stories].sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));

  return (
    <motion.div
      initial={{ opacity: 0, x: 16, y: -10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 16, y: -10 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: "fixed", top: 76, right: 20, zIndex: 40, pointerEvents: "none" }}
    >
      <div
        className="pointer-events-auto flex flex-col overflow-hidden"
        style={{
          position: "relative",
          width: 310,
          maxWidth: "calc(100vw - 48px)",
          maxHeight: "calc(100vh - 106px)",
          background: "rgba(9, 14, 9, 0.97)",
          backdropFilter: "blur(24px) saturate(170%)",
          WebkitBackdropFilter: "blur(24px) saturate(170%)",
          border: "1px solid rgba(0,255,136,0.2)",
          borderRadius: 13,
          boxShadow: "0 12px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,255,136,0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel-anchor: GlobeCanvas reads this element's screen position each frame
            to terminate the connector line at the panel's bottom-left corner. */}
        <span
          id="focus-panel-anchor"
          style={{ position: "absolute", bottom: 0, left: 12, width: 0, height: 0, pointerEvents: "none" }}
        />

        {/* Header */}
        <div style={{ padding: "11px 13px 9px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{flag}</span>
              <div className="min-w-0">
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13.5, color: "#e2e8f0", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {countryName}
                </p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569", margin: 0 }}>
                  {state.countryCode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {state.netVerdict && (
                <VerdictBadge verdict={state.netVerdict} confidence={Math.abs(state.netScore)} />
              )}
              <button
                onClick={onClose}
                style={{
                  width: 22, height: 22, borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#475569", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 600,
                  transition: "background 0.15s, color 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.09)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#475569";
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* HQ info */}
          {state.isHQCountry && state.hqTickers.length > 0 && (
            <div style={{ background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.09)", borderRadius: 6, padding: "5px 8px", marginTop: 7 }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#00FF88", margin: 0 }}>
                HQ: {state.hqTickers.join(" · ")}
              </p>
              {state.totalPositionValue > 0 && (
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#475569", margin: "2px 0 0" }}>
                  {formatMoney(state.totalPositionValue)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Signal count + scrollable list */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "6px 13px 4px", flexShrink: 0 }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#334155", margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {stories.length > 0 ? `${stories.length} signal${stories.length !== 1 ? "s" : ""}` : "No signals"}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0 13px 10px" }} className="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {stories.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stories.map((story) => (
                  <StoryRow
                    key={`${story.ticker}-${story.source}-${story.datetime}-${story.url}`}
                    story={story}
                  />
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#334155", margin: 0 }}>
                No intelligence signals yet.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "6px 13px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#1e293b", margin: 0, textAlign: "center", letterSpacing: "0.05em" }}>
            ESC OR CLICK OUTSIDE TO DISMISS
          </p>
        </div>
      </div>
    </motion.div>
  );
}
