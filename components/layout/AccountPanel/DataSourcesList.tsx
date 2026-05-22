import { SectionHeader } from "./primitives";

export function DataSourcesList({
  dataSources,
  activeCount,
}: {
  dataSources: Array<{ name: string; configured: boolean }>;
  activeCount: number;
}) {
  return (
    <div style={{ padding: "18px 18px 22px", borderBottom: "1px solid var(--color-rule)" }}>
      <SectionHeader
        title="Data Sources"
        icon="database"
        aside={
          dataSources.length > 0
            ? {
                text: `${activeCount} / ${dataSources.length} active`,
                color:
                  activeCount === dataSources.length
                    ? "var(--color-positive-dim)"
                    : "#c79c4d",
              }
            : undefined
        }
      />
      <div className="flex flex-col" style={{ gap: 6 }}>
        {dataSources.map((ds) => (
          <div
            key={ds.name}
            style={{
              border: ds.configured
                ? "1px solid rgba(0,255,136,0.18)"
                : "1px solid var(--color-rule)",
              borderRadius: 6,
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              background: ds.configured
                ? "linear-gradient(180deg, rgba(0,255,136,0.04), transparent 60%), rgba(255,255,255,0.015)"
                : "rgba(255,255,255,0.015)",
              opacity: ds.configured ? 1 : 0.85,
              position: "relative",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {/* Diagonal hatch for missing */}
            {!ds.configured && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "inherit",
                  background:
                    "repeating-linear-gradient(45deg, transparent, transparent 7px, rgba(255,255,255,0.015) 7px, rgba(255,255,255,0.015) 8px)",
                  pointerEvents: "none",
                }}
              />
            )}
            <span
              style={{
                fontFamily: "var(--font-headline)",
                fontWeight: 600,
                fontSize: 13,
                color: ds.configured ? "white" : "var(--color-ink-dim)",
                position: "relative",
              }}
            >
              {ds.name}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: ds.configured
                  ? "var(--color-positive-dim)"
                  : "var(--color-ink-dimmer)",
                position: "relative",
              }}
            >
              {ds.configured ? "Configured" : "Missing key"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}