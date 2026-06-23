import { SectionHeader } from "./primitives";

interface SnapTradeAccount {
  id?: string;
  name?: string | null;
  number?: string | null;
  type?: string | null;
  balance?: number | null;
}
interface SnapTradeConnection {
  id?: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  disabled: boolean;
  accounts: SnapTradeAccount[];
  totalBalance: number | null;
}

// Per-brokerage row colors. Known brands get their identity color; everything
// else gets a stable color from a palette so each institution row is distinct.
const BRAND_COLORS: Record<string, string> = {
  etrade: "#7b4ae0",
  pnc: "#f58025",
};
const PALETTE = ["#00c878", "#3b9eff", "#f5a623", "#e0457b", "#9b59ff", "#1ab6b6", "#ff7a45"];
function colorFor(name: string, slug?: string | null): string {
  const key = (slug ?? name).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (BRAND_COLORS[key]) return BRAND_COLORS[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function money(n: number): string {
  return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// Some SnapTrade square logos ship with a baked-in white background (JPGs) that
// can't be removed in CSS. scripts/prep-brokerage-logos.ts keys those to
// transparent and writes public/brokerages/<normalized-slug>.png. We try that
// local copy first and fall back to the remote URL via <img onError> — no
// hand-maintained override map needed.
function localLogo(name: string, slug: string | null | undefined): string {
  const key = (slug ?? name).toLowerCase().replace(/[^a-z0-9]/g, "");
  return `/brokerages/${key}.png`;
}

export function BrokerageCard({
  snapTradeConfigured = true,
  snapTradeConnected = false,
  snapTradeConnections = [],
  snapTradeConnecting = false,
  onConnectSnapTrade,
  onDisconnectSnapTrade,
}: {
  snapTradeConfigured?: boolean;
  snapTradeConnected?: boolean;
  snapTradeConnections?: SnapTradeConnection[];
  snapTradeConnecting?: boolean;
  onConnectSnapTrade?: () => void;
  onDisconnectSnapTrade?: () => void;
}) {
  if (!snapTradeConfigured) return null;

  return (
    <div style={{ padding: "18px 18px 22px", borderBottom: "1px solid var(--color-rule)" }}>
      <SectionHeader title="Brokerage Connection" icon="link" />

      <div
        style={{
          borderRadius: 10,
          background: "rgba(0,0,0,0.55)",
          borderTop: "1.5px solid rgba(82,196,194,0.6)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top glow — SnapTrade brand teal */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 60,
            background:
              "radial-gradient(ellipse 100% 60px at 50% 0%, rgba(82,196,194,0.20) 0%, rgba(4,88,86,0.06) 60%, transparent 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Head row */}
        <div style={{ padding: "14px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "relative" }}>
          <img
            src="/snaptrade-logo.svg"
            alt="SnapTrade"
            style={{ height: 22, width: "auto", display: "block" }}
          />
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-ink-dimmer)", textAlign: "right" }}>
            {snapTradeConnected ? `${snapTradeConnections.length} connection${snapTradeConnections.length === 1 ? "" : "s"}` : "Multi-broker"}
          </div>
        </div>

        {/* Connection rows */}
        {snapTradeConnections.length > 0 && (
          <div style={{ padding: "0 12px 4px", display: "flex", flexDirection: "column", gap: 6 }}>
            {snapTradeConnections.map((c, i) => {
              const color = colorFor(c.name, c.slug);
              const remoteSrc = c.logo ?? null;
              // Local keyed copies are generated from the remote logo, so a logo
              // exists iff there's a remote URL. Try the local (transparent) copy
              // first; onError falls back to remote.
              const localSrc = localLogo(c.name, c.slug);
              const hasLogo = !!remoteSrc;
              return (
                <div
                  key={c.id ?? i}
                  style={{
                    borderRadius: 7,
                    background: "rgba(255,255,255,0.025)",
                    borderLeft: `3px solid ${color}`,
                    padding: "8px 10px",
                  }}
                >
                  <div className="flex items-center justify-between" style={{ gap: 8 }}>
                    <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
                      {hasLogo ? (
                        <img
                          src={localSrc}
                          alt={c.name}
                          width={28}
                          height={28}
                          onError={(e) => {
                            // Local keyed copy missing → fall back to remote, then
                            // to nothing (avoid an infinite onError loop).
                            const img = e.currentTarget;
                            if (remoteSrc && img.src !== remoteSrc) {
                              img.src = remoteSrc;
                            } else {
                              img.style.display = "none";
                            }
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            flexShrink: 0,
                            borderRadius: 6,
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: color,
                            flexShrink: 0,
                            boxShadow: `0 0 6px ${color}`,
                          }}
                        />
                      )}
                      <span style={{ fontFamily: "var(--font-headline)", fontWeight: 600, fontSize: 13, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.name}
                      </span>
                    </div>
                    {c.totalBalance != null && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "white", flexShrink: 0 }}>
                        {money(c.totalBalance)}
                      </span>
                    )}
                  </div>

                  {/* Status + accounts */}
                  <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: c.disabled ? "var(--color-negative)" : "var(--color-positive)" }}>
                      {c.disabled ? "Reconnect needed" : "Active"}
                    </span>
                    {c.accounts.length > 0 ? (
                      c.accounts.map((a, j) => (
                        <div key={a.id ?? j} className="flex items-center justify-between" style={{ gap: 8 }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-ink-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {a.name ?? a.type ?? "Account"}
                            {a.number ? ` ••${String(a.number).slice(-4)}` : ""}
                          </span>
                          {a.balance != null && (
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-ink-dim)", flexShrink: 0 }}>
                              {money(a.balance)}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-ink-dimmer)" }}>
                        No accounts reported
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: "8px 12px 12px", display: "flex", gap: 6 }}>
          <button
            onClick={onConnectSnapTrade}
            disabled={snapTradeConnecting}
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
              cursor: snapTradeConnecting ? "wait" : "pointer",
              opacity: snapTradeConnecting ? 0.4 : 1,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!snapTradeConnecting) {
                e.currentTarget.style.background = "rgba(0,200,120,0.08)";
                e.currentTarget.style.borderColor = "rgba(0,200,120,0.4)";
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
              {snapTradeConnected ? "add_link" : "link"}
            </span>
            {snapTradeConnecting ? "Opening…" : snapTradeConnected ? "Add / manage" : "Connect brokerage"}
          </button>
          {snapTradeConnected && (
            <button
              onClick={onDisconnectSnapTrade}
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
              title="Disconnect SnapTrade"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                link_off
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
