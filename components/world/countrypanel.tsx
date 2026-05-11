"use client";

import { motion } from "framer-motion";
import VerdictBadge from "@/components/bars/VerdictBadge";
import NewsCard from "@/components/cards/NewsCard";
import StockLogo from "@/components/ui/StockLogo";
import type { CountryState, GeoStory } from "@/types/geo.types";
import type { ClassifiedStory } from "@/types/news.types";

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

function toClassifiedStory(story: GeoStory): ClassifiedStory {
  const normalizedSource: ClassifiedStory["source"] =
    story.source === "polygon" || story.source === "newsapi"
      ? story.source
      : "finnhub";

  return {
    ...story,
    source: normalizedSource,
    classifiedAt: new Date(story.datetime < 10_000_000_000 ? story.datetime * 1000 : story.datetime).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  state: CountryState;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CountryFocusPanel({ state, onClose }: Props) {
  const countryName = COUNTRY_NAMES[state.countryCode] ?? state.countryCode;
  const flag = flagEmoji(state.countryCode);
  const stories = [...state.stories]
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
    .map(toClassifiedStory);
  const tickers = state.hqTickers;

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
          width: 360,
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

          {/* Position grid: logos above tickers, max 3 per row */}
          {state.isHQCountry && tickers.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 8, paddingTop: 8 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 6,
                }}
              >
                {tickers.slice(0, 9).map((ticker) => (
                  <div
                    key={ticker}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      padding: "5px 0 3px",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <StockLogo ticker={ticker} size={28} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.03em" }}>
                      {ticker}
                    </span>
                  </div>
                ))}
              </div>

              {/* Total position value — full dollar amount */}
              {state.totalPositionValue > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    padding: "5px 8px",
                    borderRadius: 6,
                    background: "rgba(0,255,136,0.04)",
                    border: "1px solid rgba(0,255,136,0.09)",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: "#00FF88" }}>
                    ${state.totalPositionValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569", marginLeft: 4 }}>
                    total
                  </span>
                </div>
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

          <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 10px" }} className="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {stories.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {stories.map((story) => (
                  <NewsCard
                    key={`${story.ticker}-${story.source}-${story.datetime}-${story.url}`}
                    story={story}
                    compact
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