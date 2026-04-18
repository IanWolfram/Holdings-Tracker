"use client";

import { motion } from "framer-motion";
import VerdictBadge from "@/components/VerdictBadge";
import CompanyLogo from "@/components/ui/CompanyLogo";
import Sparkline from "@/components/ui/Sparkline";
import { formatCurrency, formatPercent, formatGainLoss } from "@/lib/utils/format";
import type { CompanyProfile, GeoStory } from "@/types/geo.types";
import type { Position } from "@/types/position.types";

// ---------------------------------------------------------------------------
// Helpers
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

function netVerdictFromStories(stories: GeoStory[]): { verdict: "BUY" | "SELL" | "HOLD" | null; score: number } {
  if (stories.length === 0) return { verdict: null, score: 0 };
  const buy = stories.filter((s) => s.verdict === "BUY").length;
  const sell = stories.filter((s) => s.verdict === "SELL").length;
  const hold = stories.filter((s) => s.verdict === "HOLD").length;
  let verdict: "BUY" | "SELL" | "HOLD";
  if (buy > sell && buy >= hold) verdict = "BUY";
  else if (sell > buy && sell >= hold) verdict = "SELL";
  else verdict = "HOLD";
  const avg = stories.reduce((s, st) => s + st.confidence, 0) / stories.length;
  return { verdict, score: avg };
}

// ---------------------------------------------------------------------------
// Story row
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
          {story.originCountryCode && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569" }}>
              {story.originCountryCode}
            </span>
          )}
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
// Props
// ---------------------------------------------------------------------------

interface Props {
  profile: CompanyProfile;
  stories: GeoStory[];
  position?: Position;
  onClose: () => void;
  stockIndex?: number;
  stockCount?: number;
  isHoverPreview?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StockFocusPanel({ profile, stories, position, onClose: _onClose, stockIndex, stockCount, isHoverPreview }: Props) {
  const sorted = [...stories].sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  const { verdict, score } = netVerdictFromStories(stories);
  const countryName = COUNTRY_NAMES[profile.countryCode] ?? profile.country;
  const flag = flagEmoji(profile.countryCode);

  // Verdict bar proportions from stories
  const buy = stories.filter((s) => s.verdict === "BUY").length;
  const sell = stories.filter((s) => s.verdict === "SELL").length;
  const total = buy + sell;
  const verdictScore = total > 0 ? buy / total : 0.5;
  const verdictColor = verdictScore > 0.5 ? "#00FF88" : verdictScore < 0.5 ? "#FF4444" : "#64748b";
  const verdictLabel = verdictScore > 0.5 ? "BULLISH" : verdictScore < 0.5 ? "BEARISH" : "NEUTRAL";

  // Position financials
  const gainPositive = (position?.gainLoss ?? 0) >= 0;
  const gainStr = position ? formatGainLoss(position.gainLoss) : null;
  const gainPct = position && position.pricePaid > 0
    ? ((position.currentPrice - position.pricePaid) / position.pricePaid) * 100
    : null;
  const gainPctStr = gainPct !== null ? formatPercent(gainPct) : null;
  const mvStr = position ? formatCurrency(position.marketValue) : null;
  const priceStr = position ? formatCurrency(position.currentPrice) : null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 16, y: -10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 16, y: -10 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: "fixed", top: 76, right: 20, zIndex: 40, pointerEvents: "none" }}
    >
      <div
        className={`${isHoverPreview ? "pointer-events-none" : "pointer-events-auto"} flex flex-col overflow-hidden`}
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
        {/* Panel anchor for SVG connector */}
        <span
          id="focus-panel-anchor"
          style={{ position: "absolute", bottom: 0, left: 12, width: 0, height: 0, pointerEvents: "none" }}
        />

        {/* ── PositionCard-style header ── */}
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>

          {/* Top row: logo + ticker/name + sparkline + close */}
          <div style={{ padding: "12px 13px 10px", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <CompanyLogo ticker={profile.ticker} size={40} radius={9} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {profile.ticker}
                </span>
                {verdict && <VerdictBadge verdict={verdict} confidence={score} />}
              </div>
              <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, color: "#475569", margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile.name}
              </p>
              {mvStr && (
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: "#ffffff", margin: "4px 0 0", lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {mvStr}
                </p>
              )}
              {priceStr && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#64748b", fontWeight: 500 }}>
                  {priceStr} <span style={{ opacity: 0.5, fontSize: 8 }}>/ SH</span>
                </span>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
              {position?.history && position.history.length > 0 && (
                <Sparkline data={position.history} width={80} height={36} />
              )}
            </div>
          </div>

          {/* Gain/loss row */}
          {gainStr && gainPctStr && (
            <div style={{ padding: "6px 13px", borderTop: "1px solid rgba(255,255,255,0.03)", background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 900, color: gainPositive ? "#00FF88" : "#FF4444" }}>
                  {gainStr}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: gainPositive ? "#00FF88" : "#FF4444", opacity: 0.8 }}>
                  {gainPctStr}
                </span>
              </div>
              {position && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {position.quantity} <span style={{ opacity: 0.4 }}>SH</span>
                </span>
              )}
            </div>
          )}

          {/* Verdict bar */}
          {stories.length > 0 && (
            <div style={{ padding: "8px 13px 10px", borderTop: "1px solid rgba(255,255,255,0.03)", background: "rgba(9,18,9,0.4)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ width: "100%", height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${verdictScore * 100}%`, background: "#00FF88", boxShadow: "0 0 8px rgba(0,255,136,0.3)", transition: "width 0.8s ease-out" }} />
                  <div style={{ width: `${(1 - verdictScore) * 100}%`, background: "#FF4444", boxShadow: "0 0 8px rgba(255,68,68,0.3)", transition: "width 0.8s ease-out" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 900, color: "#334155", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                    Verdict
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: verdictColor }}>
                    {verdictLabel}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Meta: sector / industry / HQ country */}
          <div style={{ padding: "6px 13px 8px", borderTop: "1px solid rgba(255,255,255,0.03)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {profile.sector && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#334155", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em" }}>
                {profile.sector.toUpperCase()}
              </span>
            )}
            {profile.industry && profile.industry !== profile.sector && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#334155", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.05em" }}>
                {profile.industry.toUpperCase()}
              </span>
            )}
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569" }}>
              {flag} {countryName}
            </span>
          </div>
        </div>

        {/* Signal count + scrollable list */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "6px 13px 4px", flexShrink: 0 }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#334155", margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {sorted.length > 0 ? `${sorted.length} signal${sorted.length !== 1 ? "s" : ""}` : "No signals"}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0 13px 10px" }} className="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {sorted.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sorted.map((story) => (
                  <StoryRow
                    key={`${story.source}-${story.datetime}-${story.url}`}
                    story={story}
                  />
                ))}
              </div>
            ) : (
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#334155", margin: 0 }}>
                No intelligence signals for {profile.ticker} yet.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "6px 13px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          {stockIndex !== undefined && stockCount !== undefined ? (
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#334155", margin: 0, textAlign: "center", letterSpacing: "0.05em" }}>
              ← {stockIndex} OF {stockCount} · ESC TO DISMISS →
            </p>
          ) : (
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#1e293b", margin: 0, textAlign: "center", letterSpacing: "0.05em" }}>
              ESC OR CLICK OUTSIDE TO DISMISS
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
