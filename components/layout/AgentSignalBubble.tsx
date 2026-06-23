"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";

const AGENT_ACCENT = "#ff8a3d";

/** First sentence of the body, truncated with an ellipsis. */
function teaser(body: string | null): string {
  if (!body) return "";
  const trimmed = body.trim();
  const m = trimmed.match(/^.*?[.!?](\s|$)/);
  const sentence = (m ? m[0] : trimmed).trim().replace(/[.!?]+$/, "");
  return `${sentence}…`;
}

/**
 * Collapsed-by-default agent signal indicator in the TopBar. Renders a small
 * pulsing orange arrow next to the Agent tab; on hover it expands rightward to
 * reveal the latest unread signal (title + first sentence). Clicking routes to
 * /agent and marks it read.
 */
export default function AgentSignalBubble() {
  const router = useRouter();
  const { latestUnread, unreadCount, markRead } = useNotifications();
  const [hover, setHover] = useState(false);

  if (!latestUnread) return null;

  const onClick = () => {
    markRead(latestUnread.id);
    router.push(latestUnread.link ?? "/agent");
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={latestUnread.title}
      style={{
        // Pull the arrow up against the Agent tab (parent gap is 36px); keep a
        // few px clearance so the button never overlaps the tab's hover area.
        position: "relative",
        marginLeft: -32,
        display: "flex",
        alignItems: "center",
        gap: hover ? 10 : 0,
        cursor: "pointer",
        textAlign: "left",
        background: hover ? "linear-gradient(180deg, rgba(255,138,61,0.10), rgba(20,20,22,0.96))" : "transparent",
        border: `1px solid ${hover ? `${AGENT_ACCENT}66` : "transparent"}`,
        borderRadius: 12,
        padding: hover ? "8px 14px 8px 11px" : "5px 6px",
        boxShadow: hover ? `0 6px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,138,61,0.06)` : "none",
        backdropFilter: hover ? "blur(8px) saturate(150%)" : "none",
        WebkitBackdropFilter: hover ? "blur(8px) saturate(150%)" : "none",
        transition: "gap .2s ease, padding .2s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease",
      }}
    >
      {/* collapsed indicator — a small orange arrow (pulses while collapsed) */}
      <span
        aria-hidden
        style={{
          width: 0,
          height: 0,
          borderTop: "6px solid transparent",
          borderBottom: "6px solid transparent",
          borderLeft: `9px solid ${AGENT_ACCENT}`,
          filter: `drop-shadow(0 0 5px ${AGENT_ACCENT}aa)`,
          flexShrink: 0,
          animation: hover ? "none" : "pulse-dot 1.8s ease-in-out infinite",
        }}
      />

      {/* expandable message — collapses to zero width when not hovered.
          minWidth:0 is required: as a flex child its default min-width:auto
          would override max-width:0 and keep it content-width (an invisible
          box that overlaps + steals hover from the Agent tab). */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          minWidth: 0,
          maxWidth: hover ? 230 : 0,
          opacity: hover ? 1 : 0,
          overflow: "hidden",
          transition: "max-width .22s ease, opacity .18s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-body, Inter)",
              fontSize: 12,
              fontWeight: 700,
              color: "white",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {latestUnread.title}
          </span>
          {unreadCount > 1 && (
            <span
              style={{
                flexShrink: 0,
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 9,
                fontWeight: 700,
                color: AGENT_ACCENT,
                background: `${AGENT_ACCENT}1f`,
                border: `1px solid ${AGENT_ACCENT}44`,
                borderRadius: 999,
                padding: "1px 6px",
              }}
            >
              +{unreadCount - 1}
            </span>
          )}
        </div>
        <span
          style={{
            fontFamily: "var(--font-body, Inter)",
            fontSize: 11,
            color: "rgba(226,226,230,0.72)",
            lineHeight: 1.35,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 220,
          }}
        >
          {teaser(latestUnread.body)}
        </span>
      </div>
    </button>
  );
}
