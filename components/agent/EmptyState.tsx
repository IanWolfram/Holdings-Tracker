"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./icons";
import { ACCENT, type OverviewStats, type ScanCard } from "./types";
import { SUGGESTED_PROMPTS, QUICK_ACTIONS, type QuickAction, type PromptCategory } from "./constants";

function MicroLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: "var(--ink-dim)",
        ...style,
      }}
    >
      <span style={{ display: "flex", alignItems: "center" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
    </div>
  );
}

function Stat({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div style={{ padding: "10px 16px", borderRight: "1px solid var(--rule)", background: "rgba(255,255,255,0.015)", minWidth: 110 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", color: "var(--ink-dimmer)", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "white", letterSpacing: "-0.01em" }}>{value}</div>
      {sub && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, color: subColor || "var(--ink-dim)", marginTop: 2, letterSpacing: "0.04em" }}>{sub}</div>
      )}
    </div>
  );
}

function fmtMoney(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtPct(v: number | null): string {
  if (v == null) return "";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function GreetingStrip({ stats }: { stats: OverviewStats | null }) {
  const now = new Date();
  const dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const spxVal = stats?.spx ? stats.spx.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—";
  const spxSub = stats?.spx ? fmtPct(stats.spx.changePercent) : "";
  const spxColor = stats?.spx ? (stats.spx.changePercent >= 0 ? "var(--positive)" : "var(--negative)") : undefined;
  const queue = stats?.queueCount;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "end", gap: 24, padding: "32px 0 28px", borderBottom: "1px solid var(--rule)" }}>
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.24em", color: ACCENT, textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <span>Agent · Ready</span>
        </div>
        <h1 style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: 38, letterSpacing: "-0.025em", color: "white", margin: 0, lineHeight: 1.05, textWrap: "balance" }}>
          What should I look into,
          <br />
          <span style={{ color: "var(--ink-dim)" }}>before the close?</span>
        </h1>
      </div>

      <div style={{ display: "grid", gridAutoFlow: "column", gap: 0, alignSelf: "end", border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden" }}>
        <Stat label="DATE" value={dateLine.split(",")[0].toUpperCase()} sub={dateLine.split(",")[1]?.trim().toUpperCase()} />
        <Stat label="S&P 500" value={spxVal} sub={spxSub} subColor={spxColor} />
        <Stat label="BOOK" value={fmtMoney(stats?.bookValue ?? null)} sub={stats ? `${stats.holdingsCount} HOLDINGS` : ""} />
        <div style={{ padding: "10px 16px", background: "rgba(255,255,255,0.015)", minWidth: 110 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", color: "var(--ink-dimmer)", textTransform: "uppercase", marginBottom: 4 }}>QUEUE</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "white", letterSpacing: "-0.01em" }}>{queue == null ? "—" : queue}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, color: "var(--warn)", marginTop: 2, letterSpacing: "0.04em" }}>{queue ? "UNANALYZED" : queue === 0 ? "CLEAR" : ""}</div>
        </div>
      </div>
    </div>
  );
}

function PromptItem({ title, meta, onClick }: { title: string; meta: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: "left",
        background: hover ? "rgba(255,255,255,0.025)" : "transparent",
        border: 0,
        cursor: "pointer",
        padding: "12px 14px",
        borderRadius: 8,
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 10,
        alignItems: "center",
        transition: "background .15s",
        color: "var(--ink)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 500, color: hover ? "white" : "var(--ink)", lineHeight: 1.4, marginBottom: 4, transition: "color .15s" }}>{title}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, color: "var(--ink-dim)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</div>
      </div>
      <Icon name="arrow_forward" style={{ fontSize: 16, color: hover ? ACCENT : "var(--ink-dimmer)", transform: hover ? "translateX(2px)" : "translateX(0)", transition: "all .2s" }} />
    </button>
  );
}

function PromptCategoryBlock({ cat, onPick }: { cat: PromptCategory; onPick: (text: string) => void }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid var(--rule)" }}>
        <Icon name={cat.icon} style={{ fontSize: 16, color: ACCENT }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.24em", color: "var(--ink)" }}>{cat.cat}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {cat.items.map((p, i) => (
          <PromptItem key={i} title={p.title} meta={p.meta} onClick={() => onPick(p.title)} />
        ))}
      </div>
    </div>
  );
}

function QuickActionTile({ action, onClick }: { action: QuickAction; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: "left",
        background: hover ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
        border: `1px solid ${hover ? "rgba(255,255,255,0.14)" : "var(--rule)"}`,
        cursor: "pointer",
        padding: "14px 16px",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        gap: 14,
        transition: "all .15s",
        color: "var(--ink)",
        minHeight: 60,
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: hover ? `${ACCENT}1f` : "rgba(255,255,255,0.03)",
          border: `1px solid ${hover ? `${ACCENT}55` : "rgba(255,255,255,0.06)"}`,
          color: hover ? ACCENT : "var(--ink)",
          transition: "all .15s",
          flexShrink: 0,
        }}
      >
        <Icon name={action.icon} style={{ fontSize: 20 }} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "white", letterSpacing: "-0.005em" }}>{action.label}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-dim)", marginTop: 3, letterSpacing: "0.02em" }}>{action.sub}</div>
      </div>
    </button>
  );
}

const STATUS_MAP: Record<ScanCard["last"]["status"], { color: string; label: string }> = {
  ok: { color: "var(--positive)", label: "OK" },
  warn: { color: "var(--warn)", label: "FLAG" },
  queued: { color: "var(--ink-dim)", label: "IDLE" },
  err: { color: "var(--negative)", label: "ERROR" },
};

function ScheduledScanCard({ scan }: { scan: ScanCard }) {
  const [hover, setHover] = useState(false);
  const s = STATUS_MAP[scan.last.status] || STATUS_MAP.ok;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "rgba(255,255,255,0.015)",
        border: `1px solid ${hover ? "rgba(255,255,255,0.14)" : "var(--rule)"}`,
        borderRadius: 10,
        padding: 14,
        transition: "all .15s",
        position: "relative",
        overflow: "hidden",
        opacity: scan.enabled ? 1 : 0.7,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, boxShadow: scan.last.status === "warn" ? `0 0 6px ${s.color}` : "none", flexShrink: 0 }} />
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "white", letterSpacing: "-0.005em" }}>{scan.name}</div>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: s.color }}>{scan.enabled ? s.label : "OFF"}</div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-dim)", marginBottom: 12, letterSpacing: "0.02em" }}>
        <span><span style={{ color: "var(--ink-dimmer)" }}>RUN ·</span> {scan.cadence}</span>
        <span><span style={{ color: "var(--ink-dimmer)" }}>NEXT ·</span> {scan.next}</span>
        <span><span style={{ color: "var(--ink-dimmer)" }}>SCOPE ·</span> {scan.coverage}</span>
      </div>

      <div style={{ background: "rgba(0,0,0,0.3)", borderLeft: `2px solid ${s.color}`, padding: "8px 10px", borderRadius: 4, fontFamily: "var(--font-body)", fontSize: 12, color: "var(--on-surface-variant)", lineHeight: 1.5 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", color: "var(--ink-dimmer)", marginBottom: 3 }}>LAST · {scan.last.at}</div>
        {scan.last.note}
      </div>
    </div>
  );
}

export default function EmptyState({
  onPick,
  onQuickAction,
  stats,
  scans,
}: {
  onPick: (text: string) => void;
  onQuickAction: (action: QuickAction) => void;
  stats: OverviewStats | null;
  scans: ScanCard[];
}) {
  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 40px 220px" }}>
      <GreetingStrip stats={stats} />

      <section style={{ paddingTop: 40 }}>
        <MicroLabel style={{ marginBottom: 20 }}>
          Start a thread
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-dimmer)", fontWeight: 500, letterSpacing: "0.18em", marginLeft: 12 }}>9 SUGGESTIONS · TAILORED TO YOUR BOOK</span>
        </MicroLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
          {SUGGESTED_PROMPTS.map((c) => (
            <PromptCategoryBlock key={c.cat} cat={c} onPick={onPick} />
          ))}
        </div>
      </section>

      <section style={{ paddingTop: 44, display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 36 }}>
        <div>
          <MicroLabel style={{ marginBottom: 16 }}>Quick actions</MicroLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {QUICK_ACTIONS.map((a) => (
              <QuickActionTile key={a.id} action={a} onClick={() => onQuickAction(a)} />
            ))}
          </div>
        </div>

        <div>
          <MicroLabel style={{ marginBottom: 16 }}>
            Watching for you
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-dimmer)", fontWeight: 500, letterSpacing: "0.18em", marginLeft: 12 }}>{scans.length} BACKGROUND SCANS</span>
          </MicroLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {scans.map((s) => (
              <ScheduledScanCard key={s.kind} scan={s} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
