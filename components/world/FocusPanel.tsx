"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import VerdictBadge from "@/components/bars/VerdictBadge";
import NewsCard from "@/components/cards/NewsCard";
import StockLogo from "@/components/ui/StockLogo";
import type { CompanyProfile, CountryState, WorldData } from "@/types/geo.types";
import type { ClassifiedStory, Verdict } from "@/types/news.types";
import type { Position } from "@/types/position.types";
import type { GlobeFocusTarget } from "@/components/world/GlobeCanvas";

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

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Shared shell pieces — used by both the country and stock views
// ---------------------------------------------------------------------------

// Shared shell chrome, sans width. The country view is content-sized (grows to
// fit its row of logos, never below MIN_COUNTRY_WIDTH); the stock view is fixed.
const SHELL_BASE = {
  position: "relative",
  maxWidth: "calc(100vw - 48px)",
  maxHeight: "calc(100vh - 106px)",
  background: "rgba(9, 14, 9, 0.97)",
  backdropFilter: "blur(24px) saturate(170%)",
  WebkitBackdropFilter: "blur(24px) saturate(170%)",
  border: "1px solid rgba(0,255,136,0.2)",
  borderRadius: 13,
  boxShadow: "0 12px 48px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,255,136,0.04)",
} as const;

// Floor that fits the header (flag + country name + total + close) un-truncated.
const MIN_COUNTRY_WIDTH = 300;

function CloseButton({ onClose }: { onClose: () => void }) {
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "rgba(255,255,255,0.09)";
    e.currentTarget.style.color = "#e2e8f0";
  };
  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
    e.currentTarget.style.color = "#475569";
  };

  return (
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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      ×
    </button>
  );
}

function PanelHeader({
  icon, title, subtitle, badge, onClose, extra,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  onClose: () => void;
  extra?: ReactNode;
}) {
  return (
    <div style={{ padding: "6px 13px 6px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>{icon}</span>
          <div className="min-w-0">
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13.5, color: "#e2e8f0", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {title}
            </p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
          <CloseButton onClose={onClose} />
        </div>
      </div>
      {extra}
    </div>
  );
}

function SignalsList({ stories, loading }: { stories: ClassifiedStory[]; loading?: boolean }) {
  const empty = stories.length === 0;
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "6px 13px 4px", flexShrink: 0 }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#334155", margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {loading && empty
            ? "Scanning signals…"
            : empty
              ? "No signals"
              : `${stories.length} signal${stories.length !== 1 ? "s" : ""}`}
        </p>
      </div>
      <div
        style={{ flex: 1, overflowY: "auto", padding: "0 6px 10px" }}
        className="scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        {!empty ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {stories.map((story) => (
              <NewsCard
                key={`${story.ticker}-${story.source}-${story.datetime}-${story.url}`}
                story={story}
                compact={true}
              />
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "#334155", margin: 0 }}>
            {loading ? "Pulling intelligence signals…" : "No intelligence signals yet."}
          </p>
        )}
      </div>
    </div>
  );
}

function PanelFooter({ text }: { text: string }) {
  return (
    <div style={{ padding: "6px 13px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#1e293b", margin: 0, textAlign: "center", letterSpacing: "0.05em" }}>
        {text}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Country view
// ---------------------------------------------------------------------------

function CountryView({
  state, onClose, onStockClick,
}: {
  state: CountryState;
  onClose: () => void;
  onStockClick: (ticker: string) => void;
}) {
  const countryName = COUNTRY_NAMES[state.countryCode] ?? state.countryCode;
  const flag = flagEmoji(state.countryCode);
  const tickers = state.hqTickers;

  // Logos are the focal point: a single horizontal row of large tiles. The
  // shell is content-sized, so the panel widens to fit however many there are.
  const grid =
    state.isHQCountry && tickers.length > 0 ? (
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 8, paddingTop: 8 }}>
        <div style={{ display: "flex", flexDirection: "row", gap: 6 }}>
          {tickers.slice(0, 12).map((ticker) => (
            <motion.button
              key={ticker}
              type="button"
              onClick={() => onStockClick(ticker)}
              whileHover={{
                scale: 1.07,
                backgroundColor: "rgba(0,255,136,0.07)",
                borderColor: "rgba(0,255,136,0.32)",
                boxShadow: "0 4px 14px rgba(0,255,136,0.12)",
              }}
              whileTap={{ scale: 0.94 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                padding: "8px 8px 6px", borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.04)",
                boxShadow: "0 0 0 rgba(0,0,0,0)",
                cursor: "pointer", appearance: "none", WebkitAppearance: "none",
                font: "inherit", color: "inherit", flexShrink: 0,
              }}
            >
              <StockLogo ticker={ticker} size={36} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.03em" }}>
                {ticker}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    ) : null;

  const totalBadge =
    state.totalPositionValue > 0 ? (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.1 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#00FF88" }}>
          ${fmtMoney(state.totalPositionValue)}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569", letterSpacing: "0.04em" }}>
          total
        </span>
      </div>
    ) : null;

  return (
    <>
      <PanelHeader
        icon={<span style={{ fontSize: 20, lineHeight: 1 }}>{flag}</span>}
        title={countryName}
        subtitle={state.countryCode}
        badge={totalBadge}
        onClose={onClose}
        extra={grid}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Stock view — rebuilt to share the country panel's theme & layout
// ---------------------------------------------------------------------------

function netVerdictOf(stories: ClassifiedStory[]): { verdict: Verdict; confidence: number } | null {
  if (stories.length === 0) return null;
  const counts: Record<Verdict, number> = { BUY: 0, SELL: 0, HOLD: 0 };
  for (const s of stories) counts[s.verdict]++;
  const verdict = (["BUY", "SELL", "HOLD"] as Verdict[]).reduce((a, b) => (counts[b] > counts[a] ? b : a), "HOLD");
  return { verdict, confidence: counts[verdict] / stories.length };
}

function StockView({
  profile, position, onClose, stockIndex, stockCount,
}: {
  profile: CompanyProfile;
  position?: Position;
  onClose: () => void;
  stockIndex?: number;
  stockCount?: number;
}) {
  const [stories, setStories] = useState<ClassifiedStory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStories([]);
    fetch(`/api/news?ticker=${encodeURIComponent(profile.ticker)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setStories(data);
      })
      .catch((err) => console.error("[FocusPanel] news fetch failed:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile.ticker]);

  const sorted = [...stories].sort((a, b) => b.datetime - a.datetime);
  const net = netVerdictOf(sorted);

  const held = !!position && position.marketValue > 0;
  const gainPositive = (position?.gainLoss ?? 0) >= 0;
  const gainPct =
    position && position.pricePaid > 0
      ? ((position.currentPrice - position.pricePaid) / position.pricePaid) * 100
      : 0;
  const gainColor = gainPositive ? "#00FF88" : "#FF4444";

  const valueBox = held && position ? (
    <div
      style={{
        marginTop: 8,
        padding: "8px 10px",
        borderRadius: 6,
        background: "rgba(0,255,136,0.04)",
        border: "1px solid rgba(0,255,136,0.09)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: "#00FF88", lineHeight: 1.1 }}>
          ${fmtMoney(position.marketValue)}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569", marginTop: 2 }}>
          {position.quantity} {position.quantity === 1 ? "sh" : "sh"} @ ${fmtMoney(position.currentPrice)}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: gainColor, lineHeight: 1.1 }}>
          {gainPositive ? "+" : "−"}${fmtMoney(Math.abs(position.gainLoss))}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: gainColor, marginTop: 2 }}>
          {gainPositive ? "+" : "−"}{Math.abs(gainPct).toFixed(2)}%
        </span>
      </div>
    </div>
  ) : (
    <div style={{ marginTop: 8 }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#475569", letterSpacing: "0.04em" }}>
        {[profile.sector, profile.industry].filter(Boolean).join(" · ") || "Not currently held"}
      </span>
    </div>
  );

  const footerText =
    stockIndex !== undefined && stockCount !== undefined
      ? `←  ${stockIndex} OF ${stockCount}  ·  ESC TO DISMISS  →`
      : "ESC OR CLICK OUTSIDE TO DISMISS";

  return (
    <>
      <PanelHeader
        icon={<StockLogo ticker={profile.ticker} size={28} />}
        title={profile.name}
        subtitle={profile.ticker}
        badge={net ? <VerdictBadge verdict={net.verdict} confidence={net.confidence} /> : null}
        onClose={onClose}
        extra={valueBox}
      />
      <SignalsList stories={sorted} loading={loading} />
      <PanelFooter text={footerText} />
    </>
  );
}

// ---------------------------------------------------------------------------
// FocusPanel — single shell that morphs between the country and stock views
// ---------------------------------------------------------------------------

interface FocusPanelProps {
  focusTarget: NonNullable<GlobeFocusTarget>;
  worldData: WorldData;
  positions: Position[];
  onClose: () => void;
  onStockClick: (ticker: string) => void;
  stockIndex?: number;
  stockCount?: number;
}

export default function FocusPanel({
  focusTarget,
  worldData,
  positions,
  onClose,
  onStockClick,
  stockIndex,
  stockCount,
}: FocusPanelProps) {
  // Country view grows to fit its row of logos; stock view stays fixed-width.
  const widthStyle: React.CSSProperties =
    focusTarget.type === "country"
      ? { width: "fit-content", minWidth: MIN_COUNTRY_WIDTH }
      : { width: 360 };

  return (
    <motion.div
      initial={{ opacity: 0, x: 16, y: -10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 16, y: -10 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: "fixed", top: 76, right: 20, zIndex: 40, pointerEvents: "none" }}
    >
      <motion.div
        layout
        className="pointer-events-auto flex flex-col overflow-hidden"
        style={{ ...SHELL_BASE, ...widthStyle }}
        transition={{ layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel-anchor: GlobeCanvas reads this element's screen position each frame
            to terminate the connector line at the panel. Lives in the shell (always
            mounted) so it never blinks during a country↔stock swap. Country mode
            anchors bottom-left; stock mode anchors top-left, beside the logo — each
            matching the pre-merge panels. */}
        <span
          id="focus-panel-anchor"
          style={
            focusTarget.type === "stock"
              ? { position: "absolute", left: 0, top: 40, width: 0, height: 0, pointerEvents: "none" }
              : { position: "absolute", bottom: 0, left: 12, width: 0, height: 0, pointerEvents: "none" }
          }
        />

        <AnimatePresence mode="wait" initial={false}>
          {focusTarget.type === "country" ? (
            <motion.div
              key="country"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
            >
              <CountryView
                state={worldData.countries[focusTarget.code]}
                onClose={onClose}
                onStockClick={onStockClick}
              />
            </motion.div>
          ) : (
            <motion.div
              key="stock"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
            >
              <StockView
                profile={worldData.profiles[focusTarget.ticker]}
                position={positions.find((p) => p.ticker === focusTarget.ticker)}
                onClose={onClose}
                stockIndex={stockIndex}
                stockCount={stockCount}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
