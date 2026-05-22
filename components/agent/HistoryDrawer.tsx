"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { ACCENT, type Conversation } from "./types";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const DAY = 86_400_000;
function bucketFor(ts: number): "Today" | "This week" | "Earlier" {
  const age = Date.now() - ts;
  if (age < DAY) return "Today";
  if (age < 7 * DAY) return "This week";
  return "Earlier";
}

function DrawerThread({ conv, active, onClick, onDelete }: { conv: Conversation; active: boolean; onClick: () => void; onDelete: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        textAlign: "left",
        background: active ? "rgba(255,255,255,0.06)" : hover ? "rgba(255,255,255,0.04)" : "transparent",
        border: 0,
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        marginBottom: 2,
        position: "relative",
        transition: "background .12s",
      }}
    >
      {(hover || active) && <span style={{ position: "absolute", top: 8, bottom: 8, left: 0, width: 2, background: ACCENT, borderRadius: 2 }} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, color: active ? "white" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conv.title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-dimmer)", letterSpacing: "0.1em" }}>{relativeTime(conv.updatedAt)}</span>
          {hover && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Delete conversation"
              style={{ background: "transparent", border: 0, color: "var(--ink-dim)", cursor: "pointer", width: 18, height: 18, borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="close" style={{ fontSize: 13 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DrawerGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ margin: "6px 0 14px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", color: "var(--ink-dimmer)", textTransform: "uppercase", padding: "6px 10px 8px" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

export default function HistoryDrawer({
  open,
  onClose,
  conversations,
  activeId,
  onPick,
  onNew,
  onDelete,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string;
  onPick: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  userEmail?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = conversations
    .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const groups: Record<string, Conversation[]> = { Today: [], "This week": [], Earlier: [] };
  for (const c of filtered) groups[bucketFor(c.updatedAt)].push(c);

  const initial = (userEmail?.[0] ?? "U").toUpperCase();

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: open ? "rgba(0,0,0,0.55)" : "transparent",
          backdropFilter: open ? "blur(2px)" : "none",
          WebkitBackdropFilter: open ? "blur(2px)" : "none",
          pointerEvents: open ? "auto" : "none",
          transition: "background .2s, backdrop-filter .2s",
          zIndex: 60,
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 340,
          background: "var(--surface-container-low)",
          borderRight: "1px solid var(--rule)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .25s cubic-bezier(.22,1,.36,1)",
          zIndex: 70,
          display: "flex",
          flexDirection: "column",
          boxShadow: open ? "20px 0 60px -20px rgba(0,0,0,0.7)" : "none",
        }}
      >
        <div style={{ height: "var(--header-h)", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
          <button onClick={onClose} aria-label="Close history" style={{ background: "transparent", border: 0, width: 32, height: 32, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink)", cursor: "pointer" }}>
            <Icon name="menu_open" style={{ fontSize: 20 }} />
          </button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.24em", color: "var(--ink-dim)", textTransform: "uppercase" }}>HISTORY</span>
          <span style={{ flex: 1 }} />
          <button onClick={onNew} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 6, background: `${ACCENT}14`, border: `1px solid ${ACCENT}44`, color: ACCENT, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em" }}>
            <Icon name="edit_square" style={{ fontSize: 14 }} />
            NEW
          </button>
        </div>

        <div style={{ padding: "12px 16px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--rule)", background: "rgba(0,0,0,0.3)" }}>
            <Icon name="search" style={{ fontSize: 16, color: "var(--ink-dim)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threads…"
              style={{ flex: 1, background: "transparent", border: 0, outline: 0, color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: 13 }}
            />
          </div>
        </div>

        <div style={{ overflow: "auto", flex: 1, padding: "8px 8px 24px" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "24px 12px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-dimmer)", textAlign: "center" }}>
              {conversations.length === 0 ? "No conversations yet." : "No matches."}
            </div>
          )}
          {(["Today", "This week", "Earlier"] as const).map((label) =>
            groups[label].length > 0 ? (
              <DrawerGroup key={label} label={label}>
                {groups[label].map((c) => (
                  <DrawerThread key={c.id} conv={c} active={c.id === activeId} onClick={() => onPick(c.id)} onDelete={() => onDelete(c.id)} />
                ))}
              </DrawerGroup>
            ) : null,
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--rule)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.3)" }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, color: "var(--ink)", border: "1px solid rgba(255,255,255,0.08)" }}>{initial}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail ?? "Signed in"}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-dim)" }}>{conversations.length} conversation{conversations.length === 1 ? "" : "s"}</div>
          </div>
        </div>
      </aside>
    </>
  );
}
