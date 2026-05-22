import { SectionHeader } from "./primitives";

export function NotificationsSection({
  telegramConfigured,
}: {
  telegramConfigured: boolean;
}) {
  return (
    <div style={{ padding: "18px 18px 22px", borderBottom: "1px solid var(--color-rule)" }}>
      <SectionHeader
        title="Notifications"
        icon="notifications"
        aside={{
          text: telegramConfigured ? "1 channel" : "0 channels",
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
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 15, color: "var(--color-ink-dim)" }}
          >
            send
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-headline)",
            fontWeight: 600,
            fontSize: 13,
            color: "white",
            flex: 1,
          }}
        >
          Telegram Bot
        </span>
        {telegramConfigured ? (
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
        ) : (
          <button
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
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              e.currentTarget.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "var(--color-rule-strong)";
              e.currentTarget.style.color = "var(--color-ink)";
            }}
          >
            Set up
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
              arrow_forward
            </span>
          </button>
        )}
      </div>
    </div>
  );
}