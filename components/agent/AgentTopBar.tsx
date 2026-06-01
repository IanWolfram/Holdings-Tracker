"use client";

import Link from "next/link";
import type { AgentProgress } from "@/lib/agent/service";
import { Icon, AgentBrainIcon } from "./icons";
import { ACCENT } from "./types";

type PillState = "IDLE" | "RUNNING" | "DONE";

function mapState(status: AgentProgress["status"]): PillState {
  if (status === "running") return "RUNNING";
  if (status === "complete") return "DONE";
  return "IDLE";
}

function AnalyzerStatusPill({
  state,
  current,
  done,
  total,
  onClick,
}: {
  state: PillState;
  current?: string;
  done?: number;
  total?: number;
  onClick: () => void;
}) {
  const isRunning = state === "RUNNING";
  const isDone = state === "DONE";
  const color = isRunning || isDone ? "var(--positive)" : "var(--ink-dim)";

  return (
    <button
      onClick={onClick}
      title={isRunning ? "Cancel analysis" : "Start a portfolio analysis"}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 0,
        background: isRunning ? "rgba(0,255,136,0.06)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${isRunning ? "rgba(0,255,136,0.25)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 999,
        padding: 0,
        height: 32,
        cursor: "pointer",
        color: "var(--ink)",
        fontFamily: "var(--font-mono)",
        transition: "all .18s ease",
        overflow: "hidden",
        maxWidth: isRunning ? 460 : 120,
      }}
    >
      {isRunning ? (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          style={{
            marginLeft: 12,
            marginRight: 8,
            flexShrink: 0,
            animation: "agent-spin 0.9s linear infinite",
            filter: "drop-shadow(0 0 6px var(--positive))",
          }}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(0,255,136,0.18)" strokeWidth="2.6" />
          <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      ) : (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            marginLeft: 12,
            marginRight: 8,
            flexShrink: 0,
          }}
        />
      )}

      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.22em",
          color,
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        {state}
      </span>

      {isRunning && current && (
        <>
          <span style={{ width: 1, height: 14, background: "rgba(0,255,136,0.2)", margin: "0 12px", flexShrink: 0 }} />
          <span
            style={{
              fontSize: 11,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              flex: 1,
              fontFamily: "var(--font-body)",
            }}
          >
            {current}
          </span>
          {!!total && (
            <span style={{ fontSize: 10, color: "var(--positive)", fontWeight: 700, margin: "0 12px", flexShrink: 0, letterSpacing: "0.04em" }}>
              {done ?? 0}/{total}
            </span>
          )}
        </>
      )}

      {!isRunning && (
        <Icon name="bolt" style={{ fontSize: 16, color: "var(--ink-dim)", marginRight: 8, marginLeft: 6, flexShrink: 0 }} />
      )}

      {isRunning && (
        <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(0,255,136,0.1)", overflow: "hidden" }}>
          <span
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: "40%",
              background: "linear-gradient(90deg, transparent, var(--positive), transparent)",
              animation: "scan-progress 1.6s linear infinite",
            }}
          />
        </span>
      )}
    </button>
  );
}

export default function AgentTopBar({
  onHamburger,
  agentState,
  onPillClick,
  brandHref = "/",
}: {
  onHamburger: () => void;
  agentState: AgentProgress;
  onPillClick: () => void;
  brandHref?: string;
}) {
  const pillState = mapState(agentState.status);
  const current = agentState.currentHeadline ?? agentState.message;

  return (
    <div
      style={{
        position: "relative",
        height: "var(--header-h)",
        borderBottom: "1px solid var(--rule)",
        background: "rgba(26,27,29,0.85)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        zIndex: 50,
        gap: 16,
      }}
    >
      <button
        onClick={onHamburger}
        aria-label="Open history"
        style={{
          background: "transparent",
          border: 0,
          width: 36,
          height: 36,
          borderRadius: 6,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink)",
          cursor: "pointer",
          transition: "background .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <Icon name="menu" size={22} />
      </button>

      <Link href={brandHref} title="Back to dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <span style={{ color: ACCENT, display: "inline-flex" }}>
          <AgentBrainIcon size={22} />
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: "var(--ink-dim)",
            textTransform: "uppercase",
          }}
        >
          Background Agent
        </span>
      </Link>

      <div style={{ flex: 1 }} />

      <AnalyzerStatusPill
        state={pillState}
        current={current}
        done={agentState.articleIndex}
        total={agentState.totalArticles}
        onClick={onPillClick}
      />
    </div>
  );
}
