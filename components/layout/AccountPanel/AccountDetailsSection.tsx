import { SectionHeader, GhostButton } from "./primitives";

export function AccountDetailsSection({
  account,
  formatDate,
  onSignOut,
}: {
  account: {
    email: string | null;
    createdAt?: string;
    lastSignInAt?: string | null;
  };
  formatDate: (iso: string) => string;
  onSignOut: () => void;
}) {
  return (
    <div style={{ padding: "18px 18px 22px", borderBottom: "1px solid var(--color-rule)" }}>
      <SectionHeader title="Account" icon="shield_person" />
      <div className="flex flex-col" style={{ gap: 7, marginBottom: 12 }}>
        {account.createdAt && (
          <div className="flex items-center justify-between">
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
                color: "var(--color-ink-dim)",
              }}
            >
              Created
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                color: "white",
              }}
            >
              {formatDate(account.createdAt)}
            </span>
          </div>
        )}
        {account.lastSignInAt && (
          <div className="flex items-center justify-between">
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
                color: "var(--color-ink-dim)",
              }}
            >
              Last sign-in
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                color: "white",
              }}
            >
              {formatDate(account.lastSignInAt)}
            </span>
          </div>
        )}
      </div>
      <div className="flex" style={{ gap: 6 }}>
        <a
          href="/reset"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: 8,
            borderRadius: 5,
            background: "transparent",
            border: "1px solid var(--color-rule-strong)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--color-ink)",
            textDecoration: "none",
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
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            key
          </span>
          Change password
        </a>
        <GhostButton icon="logout" label="Sign out" onClick={onSignOut} danger />
      </div>
    </div>
  );
}