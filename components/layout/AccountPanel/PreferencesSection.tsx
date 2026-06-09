import { SectionHeader, SegmentedControl, Stepper, Toggle } from "./primitives";
import { DEFAULT_TIMESCALE, TIMESCALE_KEYS } from "@/lib/timescales";
import { ANALYZED_AGE_OPTIONS, DEFAULT_ANALYZED_AGE_DAYS } from "@/lib/analyzedAge";

// Cycling ◀ key ▶ control for the ordered timescale keys. Mirrors the visual
// language of the numeric Stepper primitive but steps over string keys.
function TimescaleStepper({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const idx = Math.max(0, TIMESCALE_KEYS.indexOf(value as (typeof TIMESCALE_KEYS)[number]));
  const go = (delta: number) => {
    const next = idx + delta;
    if (next >= 0 && next < TIMESCALE_KEYS.length) onChange(TIMESCALE_KEYS[next]);
  };

  const stepButtonStyle: React.CSSProperties = {
    width: 22,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--color-ink-dim)",
    transition: "all 0.15s ease",
  };
  const enter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.currentTarget.disabled) return;
    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
    e.currentTarget.style.color = "white";
  };
  const leave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.color = "var(--color-ink-dim)";
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1px solid var(--color-rule)",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 5,
      }}
    >
      <button
        onClick={() => go(-1)}
        disabled={idx <= 0}
        style={{ ...stepButtonStyle, opacity: idx <= 0 ? 0.3 : 1 }}
        onMouseEnter={enter}
        onMouseLeave={leave}
        aria-label="Shorter default range"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          remove
        </span>
      </button>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          color: "white",
          padding: "0 8px",
          minWidth: 38,
          textAlign: "center",
        }}
      >
        {TIMESCALE_KEYS[idx]}
      </span>
      <button
        onClick={() => go(1)}
        disabled={idx >= TIMESCALE_KEYS.length - 1}
        style={{ ...stepButtonStyle, opacity: idx >= TIMESCALE_KEYS.length - 1 ? 0.3 : 1 }}
        onMouseEnter={enter}
        onMouseLeave={leave}
        aria-label="Longer default range"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          add
        </span>
      </button>
    </div>
  );
}

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
  defaultTimescale,
  onTimescaleChange,
  analyzedMaxAgeDays,
  onAnalyzedAgeChange,
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
  defaultTimescale: string | null;
  onTimescaleChange: (v: string) => void;
  analyzedMaxAgeDays: number | null;
  onAnalyzedAgeChange: (v: number) => void;
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
        {/* Default chart range */}
        {defaultTimescale !== null && (
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
                Default chart range
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
                Position graph time window
              </div>
            </div>
            <TimescaleStepper
              value={defaultTimescale || DEFAULT_TIMESCALE}
              onChange={onTimescaleChange}
            />
          </div>
        )}
        {/* Analyzed news max age */}
        {analyzedMaxAgeDays !== null && (
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
                Analyzed news age
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
                Hide analyzed cards older than
              </div>
            </div>
            <SegmentedControl
              options={ANALYZED_AGE_OPTIONS.map((d) => `${d}d`)}
              value={`${analyzedMaxAgeDays || DEFAULT_ANALYZED_AGE_DAYS}d`}
              onChange={(v) => onAnalyzedAgeChange(parseInt(v, 10))}
            />
          </div>
        )}
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