"use client";

import { useState } from "react";
import { SectionHeader } from "./primitives";

type LinkState = "idle" | "starting" | "waiting" | "linked" | "error";

export function NotificationsSection({
  telegramConfigured,
  telegramAvailable,
}: {
  telegramConfigured: boolean;
  telegramAvailable: boolean;
}) {
  // Seed from the server-provided status; local state drives the setup flow.
  const [linked, setLinked] = useState(telegramConfigured);
  const [state, setState] = useState<LinkState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function startLinking() {
    setState("starting");
    setError(null);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.deepLink) throw new Error(data.error ?? "Failed to start linking.");
      window.open(data.deepLink, "_blank", "noopener");
      setState("waiting");
      pollForLink();
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  // After the user taps the deep link and messages the bot, the webhook records
  // their chat id. Poll a handful of times so the UI flips to "Live" on its own.
  async function pollForLink() {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch("/api/telegram/link");
        const data = await res.json();
        if (data.linked) {
          setLinked(true);
          setState("linked");
          return;
        }
      } catch {
        // transient — keep polling
      }
    }
    setState("idle"); // gave up waiting; user can retry
  }

  async function unlink() {
    try {
      await fetch("/api/telegram/link", { method: "DELETE" });
    } catch {
      // best-effort
    }
    setLinked(false);
    setState("idle");
  }

  return (
    <div style={{ padding: "18px 18px 22px", borderBottom: "1px solid var(--color-rule)" }}>
      <SectionHeader
        title="Notifications"
        icon="notifications"
        aside={{
          text: linked ? "1 channel" : "0 channels",
          color: "var(--color-ink-dimmer)",
        }}
      />
      <div
        style={{
          border: "1px solid var(--color-rule)",
          borderRadius: 8,
          padding: "11px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255,255,255,0.015)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--color-rule)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: "var(--color-ink-dim)" }}>
            send
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-headline)",
              fontWeight: 600,
              fontSize: 13,
              color: "white",
            }}
          >
            Telegram Bot
          </span>
          {state === "waiting" && (
            <div style={{ fontSize: 10, color: "var(--color-ink-dim)", marginTop: 2 }}>
              Message the bot, then come back — this updates automatically.
            </div>
          )}
          {state === "error" && error && (
            <div style={{ fontSize: 10, color: "var(--color-negative)", marginTop: 2 }}>{error}</div>
          )}
          {!telegramAvailable && !linked && (
            <div style={{ fontSize: 10, color: "var(--color-ink-dimmer)", marginTop: 2 }}>
              Unavailable — no bot configured on the server.
            </div>
          )}
        </div>

        {linked ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                background: "rgba(0,255,136,0.1)",
                border: "1px solid rgba(0,255,136,0.3)",
                borderRadius: 3,
                padding: "4px 8px",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--color-positive)",
              }}
            >
              Live
            </div>
            <button
              onClick={unlink}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-ink-dimmer)",
                fontSize: 10,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Unlink
            </button>
          </div>
        ) : (
          <button
            onClick={startLinking}
            disabled={!telegramAvailable || state === "starting" || state === "waiting"}
            style={{
              background: "transparent",
              border: "1px solid var(--color-rule-strong)",
              borderRadius: 4,
              padding: "5px 9px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase" as const,
              color: "var(--color-ink)",
              cursor: !telegramAvailable ? "not-allowed" : "pointer",
              opacity: !telegramAvailable ? 0.4 : 1,
              transition: "all 0.15s ease",
            }}
          >
            {state === "starting" || state === "waiting" ? "Waiting…" : "Set up"}
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
              arrow_forward
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
