import { SectionHeader, SegmentedControl, Stepper, Toggle } from "./primitives";

export function PreferencesSection({
  uiMode,
  setUiMode,
  newsCache,
  setNewsCache,
  positionsCache,
  setPositionsCache,
  cronOptIn,
  cronSaving,
  onCronToggle,
}: {
  uiMode: string;
  setUiMode: (v: string) => void;
  newsCache: number;
  setNewsCache: (v: number) => void;
  positionsCache: number;
  setPositionsCache: (v: number) => void;
  cronOptIn: boolean | null;
  cronSaving: boolean;
  onCronToggle: () => void;
}) {
  return (
    <div style={{ padding: "18px 18px 22px", borderBottom: "1px solid var(--color-rule)" }}>
      <SectionHeader title="Preferences" icon="tune" />
      <div className="flex flex-col" style={{ gap: 10 }}>
        {/* UI Mode */}
        <div className="flex items-center justify-between" style={{ minHeight: 28 }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "12.5px",
              color: "var(--color-ink)",
            }}
          >
            UI Mode
          </span>
          <SegmentedControl
            options={["Compact", "Cozy"]}
            value={uiMode === "compact" || uiMode === "normal" ? "Compact" : "Cozy"}
            onChange={(v) => setUiMode(v.toLowerCase())}
          />
        </div>
        {/* News cache */}
        <div className="flex items-center justify-between" style={{ minHeight: 28 }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "12.5px",
              color: "var(--color-ink)",
            }}
          >
            News cache
          </span>
          <Stepper value={newsCache} onChange={setNewsCache} />
        </div>
        {/* Positions cache */}
        <div className="flex items-center justify-between" style={{ minHeight: 28 }}>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: "12.5px",
              color: "var(--color-ink)",
            }}
          >
            Positions cache
          </span>
          <Stepper value={positionsCache} onChange={setPositionsCache} />
        </div>
        {/* Monthly recalibration */}
        {cronOptIn !== null && (
          <div>
            <div className="flex items-center justify-between" style={{ minHeight: 28 }}>
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 500,
                    fontSize: "12.5px",
                    color: "var(--color-ink)",
                  }}
                >
                  Monthly recalibration
                </span>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--color-ink-dimmer)",
                    marginTop: 3,
                  }}
                >
                  Re-runs strategy weights
                </div>
              </div>
              <Toggle
                on={cronOptIn}
                onToggle={onCronToggle}
                disabled={cronSaving}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}