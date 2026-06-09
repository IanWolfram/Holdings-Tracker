import { TokenGauge, SectionHeader } from "./primitives";

export function BrokerageCard({
  isConnected,
  isConnecting,
  expiresAt,
  countdown,
  onReconnect,
  onDisconnect,
}: {
  isConnected: boolean;
  isConnecting: boolean;
  expiresAt: string | null | undefined;
  countdown: string | null;
  onReconnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div style={{ padding: "18px 18px 22px", borderBottom: "1px solid var(--color-rule)" }}>
      <SectionHeader title="Brokerage Connection" icon="link" />
      <div
        style={{
          borderRadius: 10,
          background: "rgba(0,0,0,0.55)",
          borderTop: "1.5px solid rgba(149,76,233,0.6)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 60,
            background:
              "radial-gradient(ellipse 100% 60px at 50% 0%, rgba(149,76,233,0.2) 0%, rgba(120,60,210,0.05) 60%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
        {/* Head row */}
        <div
          style={{
            padding: "14px 14px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            position: "relative",
          }}
        >
          <div className="flex items-start gap-2.5">
            {/* Logo tile */}
            <img
              src="/etrade-logo.png"
              alt="E*TRADE"
              width={32}
              height={32}
              style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }}
            />
            <div>
              <div
                style={{
                  fontFamily: "var(--font-headline)",
                  fontWeight: 700,
                  fontSize: 15,
                  color: "white",
                  letterSpacing: "-0.01em",
                }}
              >
                E*TRADE
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--color-ink-dimmer)",
                }}
              >
                OAuth
              </div>
            </div>
          </div>
        </div>
        {/* Token gauge */}
        {isConnected && expiresAt && (
          <TokenGauge expiresAt={expiresAt} />
        )}
        {/* Actions row */}
        <div style={{ padding: "0 12px 12px", display: "flex", gap: 6 }}>
          <button
            onClick={onReconnect}
            disabled={isConnecting}
            style={{
              flex: 1,
              background: "transparent",
              border: "1px solid var(--color-rule-strong)",
              borderRadius: 5,
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              color: "var(--color-ink)",
              cursor: isConnecting ? "wait" : "pointer",
              opacity: isConnecting ? 0.4 : 1,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!isConnecting) {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.color = "white";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "var(--color-rule-strong)";
              e.currentTarget.style.color = "var(--color-ink)";
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              refresh
            </span>
            Reconnect
          </button>
          <button
            onClick={onDisconnect}
            style={{
              background: "transparent",
              border: "1px solid var(--color-rule-strong)",
              borderRadius: 5,
              padding: "8px 11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase" as const,
              color: "var(--color-ink-dim)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,68,68,0.08)";
              e.currentTarget.style.borderColor = "rgba(255,68,68,0.4)";
              e.currentTarget.style.color = "var(--color-negative)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "var(--color-rule-strong)";
              e.currentTarget.style.color = "var(--color-ink-dim)";
            }}
            title="Disconnect"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              link_off
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}