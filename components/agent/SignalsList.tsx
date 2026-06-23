"use client";

import { useMemo } from "react";
import { AgentBrainIcon } from "./icons";
import { ACCENT, type ChatMessage } from "./types";

const POSITIVE = "#00FF88";
const NEGATIVE = "#ff5d5d";

/** "today" / "1 day old" / "N days old", with an hours fallback for fresh ones. */
function ageLabel(createdAt: number | undefined): string {
  if (!createdAt) return "";
  const diff = Date.now() - createdAt;
  if (diff < 3_600_000) return "just now";
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h old`;
  const days = Math.floor(diff / 86_400_000);
  return days === 1 ? "1 day old" : `${days} days old`;
}

/** Split the stored `**title**\n\nbody` message into its title and body parts. */
function parseSignal(content: string): { title: string; body: string } {
  const trimmed = content.trim();
  const m = trimmed.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
  if (m) return { title: m[1].trim(), body: m[2].trim() };
  return { title: trimmed, body: "" };
}

function accentFor(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("positive")) return POSITIVE;
  if (t.includes("negative")) return NEGATIVE;
  return ACCENT;
}

function SignalCard({ msg }: { msg: ChatMessage }) {
  const { title, body } = parseSignal(msg.content);
  const accent = accentFor(title);
  const age = ageLabel(msg.createdAt);
  return (
    <div
      style={{
        position: "relative",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--rule)",
        borderRadius: 12,
        padding: "14px 16px 14px 18px",
        marginBottom: 12,
        animation: "fade-up .3s ease both",
      }}
    >
      <span style={{ position: "absolute", top: 14, bottom: 14, left: 0, width: 3, background: accent, borderRadius: 3 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: body ? 8 : 0 }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 700, color: "white", letterSpacing: "-0.01em", flex: 1, minWidth: 0 }}>
          {title}
        </span>
        {age && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, color: "var(--ink-dimmer)", letterSpacing: "0.08em", flexShrink: 0, whiteSpace: "nowrap" }}>
            {age}
          </span>
        )}
      </div>
      {body && (
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.5, margin: 0, textWrap: "pretty" }}>
          {body}
        </p>
      )}
    </div>
  );
}

/** Read-only feed of the user's agent signals, newest first, each dated. */
export default function SignalsList({ messages }: { messages: ChatMessage[] }) {
  const signals = useMemo(
    () => messages.filter((m) => m.role === "assistant").slice().reverse(),
    [messages],
  );

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 40px 220px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${ACCENT}14`, border: `1px solid ${ACCENT}44`, color: ACCENT }}>
          <AgentBrainIcon size={14} />
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", color: "var(--ink-dim)", textTransform: "uppercase" }}>AGENT SIGNALS</span>
        <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-dimmer)" }}>
          {signals.length} signal{signals.length === 1 ? "" : "s"}
        </span>
      </div>

      {signals.length === 0 ? (
        <div style={{ padding: "48px 12px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-dimmer)", textAlign: "center" }}>
          No signals yet. The agent posts here when a sweep finds a strong short-horizon signal.
        </div>
      ) : (
        signals.map((m) => <SignalCard key={m.id} msg={m} />)
      )}
    </div>
  );
}
