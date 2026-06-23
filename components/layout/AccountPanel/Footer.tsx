export function Footer() {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderTop: "1px solid var(--color-rule)",
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
        position: "relative",
        zIndex: 2,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          style={{
            padding: "2px 6px",
            borderRadius: 3,
            background: "rgba(255,255,255,0.04)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-ink-dim)",
          }}
        >
          Cloud
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--color-ink-faint)",
          }}
        >
          v2.4.1
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <kbd
          style={{
            padding: "1px 4px",
            border: "1px solid var(--color-rule-strong)",
            borderBottomWidth: 2,
            borderRadius: 3,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--color-ink-dim)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          Esc
        </kbd>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--color-ink-dimmer)",
          }}
        >
          to dismiss
        </span>
      </div>
    </div>
  );
}