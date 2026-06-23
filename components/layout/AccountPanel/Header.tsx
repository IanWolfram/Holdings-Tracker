export function Header({
  initials,
  account,
  onClose,
  onSignOut,
}: {
  initials: string;
  account: { email: string | null; displayName: string | null } | null;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <div
      style={{
        padding: "18px 18px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        position: "relative",
        zIndex: 2,
      }}
    >
      {/* Top fade */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 60,
          background:
            "linear-gradient(180deg, rgba(0,255,136,0.025), transparent 80%)",
          pointerEvents: "none",
          borderRadius: "inherit",
        }}
      />
      {/* Row 1: title + actions */}
      <div className="flex items-start justify-between" style={{ position: "relative" }}>
        <h2
          style={{
            fontFamily: "var(--font-headline)",
            fontWeight: 700,
            fontSize: 22,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: "white",
          }}
        >
          Account
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onSignOut}
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "1px solid transparent",
              borderRadius: 4,
              cursor: "pointer",
              color: "var(--color-ink-dim)",
              transition: "all 0.15s ease",
            }}
            title="Sign out"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,68,68,0.08)";
              e.currentTarget.style.borderColor = "rgba(255,68,68,0.4)";
              e.currentTarget.style.color = "var(--color-negative)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.color = "var(--color-ink-dim)";
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              logout
            </span>
          </button>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "1px solid transparent",
              borderRadius: 4,
              cursor: "pointer",
              color: "var(--color-ink-dim)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              e.currentTarget.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.color = "var(--color-ink-dim)";
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>
      </div>
      {/* Row 2: identity strip */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 10,
          border: "1px solid var(--color-rule)",
          borderRadius: 8,
          background: "rgba(255,255,255,0.025)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 30% 30%, rgba(0,255,136,0.18), rgba(0,255,136,0.04) 60%, rgba(255,255,255,0.04))",
            border: "1px solid rgba(0,255,136,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              fontSize: 14,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            {initials}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 12,
              color: "white",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {account?.email ?? ""}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--color-ink-dim)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>Trader</span>
            <span
              style={{
                width: 2,
                height: 2,
                borderRadius: "50%",
                background: "var(--color-ink-faint)",
                display: "inline-block",
              }}
            />
            <span>Cloud</span>
            <span
              style={{
                width: 2,
                height: 2,
                borderRadius: "50%",
                background: "var(--color-ink-faint)",
                display: "inline-block",
              }}
            />
            <span>v2.4.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}