"use client";

import { useEffect, useRef, Fragment, type ReactNode } from "react";
import { AgentBrainIcon } from "./icons";
import { ACCENT, type ChatMessage } from "./types";

function richText(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} style={{ color: "white", fontWeight: 700 }}>
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 24px", animation: "fade-up .25s ease both" }}>
      <div
        style={{
          maxWidth: "70%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "12px 12px 4px 12px",
          padding: "10px 14px",
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "white",
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function AgentMessage({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div style={{ margin: "0 0 28px", animation: "fade-up .3s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${ACCENT}14`, border: `1px solid ${ACCENT}44`, color: ACCENT }}>
          <AgentBrainIcon size={14} />
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", color: "var(--ink-dim)", textTransform: "uppercase" }}>AGENT</span>
        <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
      </div>
      <div style={{ paddingLeft: 14 }}>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--on-surface)", lineHeight: 1.55, margin: "0 0 12px", whiteSpace: "pre-wrap", textWrap: "pretty" }}>
            {richText(p)}
          </p>
        ))}
      </div>
    </div>
  );
}

function PendingMessage() {
  return (
    <div style={{ margin: "0 0 28px", animation: "fade-up .3s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", background: `${ACCENT}14`, border: `1px solid ${ACCENT}44`, color: ACCENT }}>
          <AgentBrainIcon size={14} />
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", color: "var(--ink-dim)", textTransform: "uppercase" }}>AGENT · THINKING</span>
        <span style={{ flex: 1, height: 1, background: "var(--rule)" }} />
      </div>
      <div style={{ paddingLeft: 14, display: "flex", alignItems: "center", gap: 6 }}>
        {[0, 150, 300].map((d) => (
          <span key={d} className="agent-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ink-dim)", animation: `fade-up 0.6s ease ${d}ms infinite alternate` }} />
        ))}
      </div>
    </div>
  );
}

export default function ChatThread({ messages, pending }: { messages: ChatMessage[]; pending: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pending]);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 40px 220px" }}>
      {messages.map((m) => (m.role === "user" ? <UserBubble key={m.id} text={m.content} /> : <AgentMessage key={m.id} text={m.content} />))}
      {pending && <PendingMessage />}
      <div ref={endRef} />
    </div>
  );
}
