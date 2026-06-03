"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { TickerPrediction } from "@/types/predictions";

interface PredictionStripProps {
  allPredictions: TickerPrediction[];
  correctCount: number;
  compact?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
}

interface PredictionPanelProps {
  allPredictions: TickerPrediction[];
  currentPrice?: number;
}

type OutcomeFilter = "all" | "CORRECT" | "PARTIAL" | "INCORRECT";
type SortOrder = "newest" | "oldest";

// ─── SVG primitives ────────────────────────────────────────────────────────

function TimeRing({ daysLeft, horizon }: { daysLeft: number; horizon: number }) {
  const frac = Math.max(0, Math.min(1, horizon > 0 ? daysLeft / horizon : 0));
  const r = 5;
  const c = 2 * Math.PI * r;
  const on = frac * c;
  return (
    <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeWidth="2" opacity={0.22} />
      <circle
        cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={`${on.toFixed(2)} ${(c - on).toFixed(2)}`}
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
}

function ArrowSVG({ horizon }: { horizon: number }) {
  const h = Math.max(1, Math.min(30, horizon));
  const W = Math.round(22 + ((h - 1) / 29) * 40);
  const tip = W - 1;
  const base = tip - 5;
  return (
    <svg
      viewBox={`0 0 ${W} 12`} width={W} height="12" fill="none"
      stroke="#3a3e44" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="1" y1="6" x2={tip - 0.5} y2="6" />
      <polyline points={`${base} 2 ${tip} 6 ${base} 10`} />
    </svg>
  );
}

const VERDICT_ICONS = {
  CORRECT: (
    <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2.5 7.5 6 10.5 11.5 3.5" />
    </svg>
  ),
  PARTIAL: (
    <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3" y1="7" x2="11" y2="7" />
    </svg>
  ),
  INCORRECT: (
    <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3.5" y1="3.5" x2="10.5" y2="10.5" />
      <line x1="10.5" y1="3.5" x2="3.5" y2="10.5" />
    </svg>
  ),
};

const FunnelIcon = (
  <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 2.5h11l-4.2 5v4l-2.6 1.2v-5.2z" />
  </svg>
);

const ChevronIcon = (
  <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 5 7 9 11 5" />
  </svg>
);

const SmallChevron = (
  <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 5 7 9 11 5" />
  </svg>
);

const SORT_ICONS = {
  newest: (
    <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="2.5" x2="4" y2="11.5" /><polyline points="1.5 9 4 11.5 6.5 9" />
      <line x1="8.5" y1="3.5" x2="12.5" y2="3.5" /><line x1="8.5" y1="7" x2="11.5" y2="7" /><line x1="8.5" y1="10.5" x2="10.5" y2="10.5" />
    </svg>
  ),
  oldest: (
    <svg viewBox="0 0 14 14" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="2.5" x2="4" y2="11.5" /><polyline points="1.5 5 4 2.5 6.5 5" />
      <line x1="8.5" y1="3.5" x2="10.5" y2="3.5" /><line x1="8.5" y1="7" x2="11.5" y2="7" /><line x1="8.5" y1="10.5" x2="12.5" y2="10.5" />
    </svg>
  ),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function predictedDisplay(direction: string, mag: number) {
  if (direction === "FLAT") return { colorStyle: { color: "#94a3b8" }, text: `±${mag.toFixed(1)}%` };
  if (direction === "UP") return { colorStyle: { color: "#00ff88" }, text: `+${mag.toFixed(1)}%` };
  return { colorStyle: { color: "#ff4444" }, text: `−${mag.toFixed(1)}%` };
}

function signedPct(v: number) {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
}

function formatRunDate(runAt: number) {
  return new Date(runAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDaysLeft(runAt: number, horizonDays: number): number {
  return Math.max(0, horizonDays - Math.floor((Date.now() - runAt) / 86_400_000));
}

function runTs(runAt: number) { return runAt; }

// ─── Prediction row ──────────────────────────────────────────────────────────

function PredictionRow({ p, currentPrice = 0 }: { p: TickerPrediction; currentPrice?: number }) {
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const isPending = p.status === "pending";
  const pred = predictedDisplay(p.direction, p.magnitudePct);
  const dl = getDaysLeft(p.runAt, p.horizonDays);
  const nowMove = currentPrice > 0
    ? ((currentPrice - p.priceAtPrediction) / p.priceAtPrediction) * 100
    : 0;
  const confPct = Math.round(p.confidence * 100);
  const runDate = formatRunDate(p.runAt);

  const rowBg = isPending
    ? undefined
    : p.outcome === "CORRECT"
    ? "rgba(0,255,136,0.055)"
    : p.outcome === "PARTIAL"
    ? "rgba(230,169,76,0.06)"
    : p.outcome === "INCORRECT"
    ? "rgba(255,68,68,0.055)"
    : undefined;

  const railColor = isPending
    ? "#94a3b8"
    : p.outcome === "CORRECT"
    ? "#00ff88"
    : p.outcome === "PARTIAL"
    ? "#e6a94c"
    : "#ff4444";

  const railOpacity = isPending ? 0.18 : p.outcome === "INCORRECT" ? 0.5 : 0.55;

  const verdictStyle = !isPending && p.outcome === "CORRECT"
    ? { color: "#00ff88", background: "rgba(0,255,136,0.12)" }
    : !isPending && p.outcome === "PARTIAL"
    ? { color: "#e6a94c", background: "rgba(230,169,76,0.14)" }
    : !isPending && p.outcome === "INCORRECT"
    ? { color: "#ff4444", background: "rgba(255,68,68,0.13)" }
    : { color: "#8a8f96", background: "rgba(148,163,184,0.10)" };

  const nowColorStyle = nowMove >= 0 ? { color: "#00ff88" } : { color: "#ff4444" };
  const actualColorStyle = (p.actualPct ?? 0) >= 0 ? { color: "#00ff88" } : { color: "#ff4444" };

  return (
    <article
      style={{ display: "grid", gridTemplateColumns: "2px 1fr", gap: "12px", background: rowBg, borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Status rail */}
      <div style={{ background: railColor, opacity: railOpacity }} />

      {/* Body */}
      <div style={{ padding: "8px 16px 9px 4px", minWidth: 0 }}>
        {/* Comparison group */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Predicted cell */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: "8.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#555a62" }}>
              Predicted
            </span>
            <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: "15px", fontWeight: 600, lineHeight: 1, ...pred.colorStyle }}>
              {pred.text}
            </span>
          </div>

          {/* Bridge */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", marginTop: "11px", flexShrink: 0 }}>
            <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: "8.5px", fontWeight: 600, letterSpacing: "0.06em", color: "#555a62", lineHeight: 1 }}>
              {p.horizonDays}d
            </span>
            <ArrowSVG horizon={p.horizonDays} />
          </div>

          {/* Now / Actual cell */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: "8.5px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#555a62", textAlign: "center" }}>
              {isPending ? "Now" : "Actual"}
            </span>
            {isPending ? (
              <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: "15px", fontWeight: 600, lineHeight: 1, ...nowColorStyle }}>
                {signedPct(nowMove)}
              </span>
            ) : (
              <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: "15px", fontWeight: 600, lineHeight: 1, ...actualColorStyle }}>
                {p.actualPct !== undefined ? signedPct(p.actualPct) : "—"}
              </span>
            )}
          </div>

          {/* Verdict pill */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: "10px",
              fontWeight: isPending ? 600 : 700,
              letterSpacing: "0.06em",
              padding: "4px 8px",
              borderRadius: "20px",
              flexShrink: 0,
              ...verdictStyle,
            }}
          >
            {isPending ? (
              <>
                <TimeRing daysLeft={dl} horizon={p.horizonDays} />
                {dl}d left
              </>
            ) : p.outcome ? (
              <>
                {VERDICT_ICONS[p.outcome]}
                {p.outcome}
              </>
            ) : null}
          </div>
        </div>

        {/* Meta line */}
        <div style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "4px", fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: "10.5px", color: "#8a8f96", whiteSpace: "nowrap" }}>
          <span>{confPct}% <span style={{ color: "#555a62" }}>conf</span></span>
          <span style={{ color: "#3a3e44" }}>·</span>
          <span>{runDate}</span>
          <span style={{ color: "#3a3e44" }}>·</span>
          <span>${p.priceAtPrediction.toFixed(2)}</span>
        </div>

        {/* Reasoning */}
        {p.reasoning && (
          <button
            type="button"
            onClick={() => setReasoningOpen(v => !v)}
            style={{
              marginTop: "5px",
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              display: "block",
              fontFamily: "var(--font-body, Inter, sans-serif)",
              fontSize: "11.5px",
              lineHeight: 1.5,
              color: reasoningOpen ? "#8a8f96" : "#555a62",
              transition: "color 0.15s ease",
            }}
          >
            <span style={reasoningOpen ? undefined : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 1, overflow: "hidden" } as React.CSSProperties}>
              {p.reasoning}
            </span>
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Filter dropdown (portalled) ─────────────────────────────────────────────

interface FilterMenuProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  outcome: OutcomeFilter;
  sort: SortOrder;
  onOutcome: (v: OutcomeFilter) => void;
  onSort: (v: SortOrder) => void;
  onClose: () => void;
}

function FilterMenu({ anchorRef, panelRef, outcome, sort, onOutcome, onSort, onClose }: FilterMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const reposition = useCallback(() => {
    if (!anchorRef.current || !menuRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const mw = menuRef.current.offsetWidth;
    setPos({
      top: r.bottom + 6,
      left: Math.max(8, r.right - mw),
    });
  }, [anchorRef]);

  useEffect(() => {
    reposition();
  }, [reposition]);

  useEffect(() => {
    const panel = panelRef.current;
    const handleScroll = () => reposition();
    const handleResize = () => reposition();
    panel?.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    return () => {
      panel?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [panelRef, reposition]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [anchorRef, onClose]);

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 9999,
    top: pos.top,
    left: pos.left,
    minWidth: "176px",
    background: "#18181c",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "9px",
    boxShadow: "0 18px 44px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.4)",
    padding: "5px",
  };

  const groupStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: "8.5px",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#3a3e44",
    padding: "7px 9px 5px",
  };

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "9px",
    width: "100%",
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: "11px",
    color: active ? "#e8e8ea" : "#8a8f96",
    background: active ? "rgba(255,255,255,0.05)" : "none",
    border: "none",
    textAlign: "left",
    padding: "6px 9px",
    borderRadius: "6px",
    cursor: "pointer",
  });

  const checkStyle: React.CSSProperties = {
    marginLeft: "auto",
    color: "#00ff88",
    fontSize: "10px",
  };

  const OUTCOME_OPTIONS: { val: OutcomeFilter; label: string; swatchColor: string }[] = [
    { val: "all", label: "All", swatchColor: "#555a62" },
    { val: "CORRECT", label: "Correct", swatchColor: "#00ff88" },
    { val: "PARTIAL", label: "Partial", swatchColor: "#e6a94c" },
    { val: "INCORRECT", label: "Incorrect", swatchColor: "#ff4444" },
  ];

  return createPortal(
    <div ref={menuRef} style={menuStyle} role="menu">
      <div style={groupStyle}>Outcome</div>
      {OUTCOME_OPTIONS.map(({ val, label, swatchColor }) => (
        <button
          key={val}
          style={itemStyle(outcome === val)}
          role="menuitemradio"
          aria-checked={outcome === val}
          onClick={() => { onOutcome(val); onClose(); }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: swatchColor, flexShrink: 0 }} />
          {label}
          {outcome === val && <span style={checkStyle}>✓</span>}
        </button>
      ))}
      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "5px 4px" }} />
      <div style={groupStyle}>Sort by date</div>
      {(["newest", "oldest"] as SortOrder[]).map(val => (
        <button
          key={val}
          style={itemStyle(sort === val)}
          role="menuitemradio"
          aria-checked={sort === val}
          onClick={() => { onSort(val); onClose(); }}
        >
          <span style={{ color: "#555a62", display: "flex" }}>{SORT_ICONS[val]}</span>
          {val === "newest" ? "Newest first" : "Oldest first"}
          {sort === val && <span style={checkStyle}>✓</span>}
        </button>
      ))}
    </div>,
    document.body,
  );
}

// ─── Strip (trigger) ──────────────────────────────────────────────────────────

export default function PredictionStrip({
  allPredictions,
  correctCount,
  compact = false,
  open: controlledOpen,
  onToggle,
}: PredictionStripProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const hasPredictions = allPredictions.length > 0;
  const totalCount = allPredictions.length;

  const handleToggle = () => {
    if (!hasPredictions) return;
    const next = !isOpen;
    if (onToggle) onToggle(next);
    else setInternalOpen(next);
  };

  const stripStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: compact ? "8px 10px" : "11px 16px",
    background: "rgba(0,0,0,0.18)",
    cursor: hasPredictions ? "pointer" : "default",
    width: "100%",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    textAlign: "left",
    color: "inherit",
    fontFamily: "inherit",
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-expanded={isOpen}
      aria-controls="pred-panel"
      style={stripStyle}
    >
      <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: compact ? "9px" : "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8a8f96" }}>
        Predictions
      </span>
      {totalCount > 0 ? (
        <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: compact ? "9px" : "11px", fontWeight: 600, color: "#8a8f96", whiteSpace: "nowrap" }}>
          <span style={{ color: "#00ff88", fontWeight: 600 }}>{correctCount}</span>/{totalCount} correct
        </span>
      ) : (
        <span style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: compact ? "9px" : "11px", color: "#3a3e44" }}>—</span>
      )}
      <span style={{ flex: 1 }} />
      {hasPredictions && (
        <span style={{ color: "#555a62", display: "inline-flex", transition: "transform 0.18s ease", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
          {ChevronIcon}
        </span>
      )}
    </button>
  );
}

// ─── Panel (overlay content) ──────────────────────────────────────────────────

export function PredictionPanel({ allPredictions, currentPrice = 0 }: PredictionPanelProps) {
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [menuOpen, setMenuOpen] = useState(false);

  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const pending = allPredictions.filter(p => p.status === "pending");
  const resolved = allPredictions.filter(p => p.status === "resolved");

  const filteredResolved = resolved
    .filter(p => outcomeFilter === "all" || p.outcome === outcomeFilter)
    .sort((a, b) => sortOrder === "newest" ? runTs(b.runAt) - runTs(a.runAt) : runTs(a.runAt) - runTs(b.runAt));

  const resolvedTotal = resolved.length;
  const resolvedCountDisplay = outcomeFilter === "all"
    ? resolvedTotal
    : `${filteredResolved.length}/${resolvedTotal}`;

  const filterBtnLabel = outcomeFilter !== "all"
    ? { all: "All", CORRECT: "Correct", PARTIAL: "Partial", INCORRECT: "Incorrect" }[outcomeFilter]
    : sortOrder === "newest" ? "Newest" : "Oldest";

  const hasActiveFilter = outcomeFilter !== "all";

  const sectionHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 16px",
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "#18181c",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.3)",
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: "9.5px",
    fontWeight: 700,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "#e8e8ea",
  };

  const countPillStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: "9.5px",
    fontWeight: 600,
    color: "#8a8f96",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    padding: "1px 6px",
    borderRadius: "20px",
    lineHeight: 1.5,
  };

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    fontSize: "9.5px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: active ? "#e8e8ea" : "#8a8f96",
    background: active ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "#00cc6e" : "rgba(255,255,255,0.10)"}`,
    borderRadius: "6px",
    padding: "4px 7px 4px 8px",
    cursor: "pointer",
  });

  return (
    <div
      id="pred-panel"
      ref={panelRef}
      style={{
        background: "#0d0f0e",
        height: "100%",
        overflowY: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.12) transparent",
      }}
    >
      {/* Pending section */}
      {pending.length > 0 && (
        <>
          <div style={sectionHeaderStyle}>
            <span style={sectionLabelStyle}>Pending</span>
            <span style={countPillStyle}>{pending.length}</span>
            <span style={{ flex: 1 }} />
          </div>
          {pending.map((p, i) => (
            <PredictionRow key={`${p.ticker}-${p.runAt}-${i}`} p={p} currentPrice={currentPrice} />
          ))}
        </>
      )}

      {/* Resolved section */}
      {resolved.length > 0 && (
        <>
          <div style={sectionHeaderStyle}>
            <span style={sectionLabelStyle}>Resolved</span>
            <span style={countPillStyle}>{resolvedCountDisplay}</span>
            <span style={{ flex: 1 }} />
            {/* Filter button */}
            <button
              ref={filterBtnRef}
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              style={filterBtnStyle(menuOpen || hasActiveFilter)}
            >
              {FunnelIcon}
              <span>{filterBtnLabel}</span>
              {hasActiveFilter && (
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 5px rgba(0,255,136,0.6)", marginLeft: "-1px", flexShrink: 0 }} />
              )}
              <span style={{ display: "inline-flex", transition: "transform 0.18s ease", transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                {SmallChevron}
              </span>
            </button>

            {menuOpen && (
              <FilterMenu
                anchorRef={filterBtnRef}
                panelRef={panelRef}
                outcome={outcomeFilter}
                sort={sortOrder}
                onOutcome={v => { setOutcomeFilter(v); }}
                onSort={v => { setSortOrder(v); }}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>

          {filteredResolved.length > 0 ? (
            filteredResolved.map((p, i) => (
              <PredictionRow key={`${p.ticker}-${p.runAt}-${i}`} p={p} currentPrice={currentPrice} />
            ))
          ) : (
            <div style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)", fontSize: "11px", color: "#555a62", padding: "18px 16px", textAlign: "center" }}>
              No {outcomeFilter.toLowerCase()} predictions
            </div>
          )}
        </>
      )}
    </div>
  );
}
