"use client";

import { useMemo } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;

export const CACHE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 240, 1440] as const;

export function formatExpiryParts(expiresAt: string | null): {
  label: string;
  hours: number;
  minutes: number;
} | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: "expired", hours: 0, minutes: 0 };
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return { label: `${hours}h ${mins}m`, hours, minutes: mins };
}

export function formatCountdown(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function TokenGauge({ expiresAt }: { expiresAt: string | null }) {
  const totalCells = 24;
  const parts = formatExpiryParts(expiresAt);

  const cellsLit = useMemo(() => {
    if (!parts || parts.label === "expired") return 0;
    const diff = new Date(expiresAt!).getTime() - Date.now();
    const hoursRemaining = diff / 3_600_000;
    return Math.min(totalCells, Math.ceil(hoursRemaining));
  }, [expiresAt, parts]);

  if (!parts) return null;

  return (
    <div style={{ padding: "6px 14px 12px" }}>
      <div className="flex items-center justify-between mb-1.5">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--color-ink-dim)",
          }}
        >
          Token life
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 700,
            color: "white",
          }}
        >
          {parts.label === "expired" ? (
            "Expired"
          ) : (
            <>
              {parts.hours}
              <span
                style={{
                  fontWeight: 400,
                  color: "var(--color-ink-dim)",
                  fontSize: 13,
                }}
              >
                h{" "}
              </span>
              {parts.minutes}
              <span
                style={{
                  fontWeight: 400,
                  color: "var(--color-ink-dim)",
                  fontSize: 13,
                }}
              >
                m
              </span>
            </>
          )}
        </span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: totalCells }).map((_, i) => {
          const isLit = i < cellsLit;
          const isFade1 = isLit && i === cellsLit - 1;
          const isFade2 = isLit && i === cellsLit - 2;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 1,
                background: isLit
                  ? "rgba(56,160,255,1)"
                  : "rgba(255,255,255,0.05)",
                opacity: isFade1
                  ? 0.6
                  : isFade2
                    ? 0.85
                    : isLit
                      ? 1
                      : 1,
                boxShadow: isLit
                  ? isFade1
                    ? "0 0 3px rgba(56,160,255,0.25)"
                    : isFade2
                      ? "0 0 4px rgba(56,160,255,0.3)"
                      : "0 0 6px rgba(56,160,255,0.4)"
                  : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: "1px solid var(--color-rule)",
        background: "rgba(255,255,255,0.04)",
        borderRadius: 5,
        padding: 2,
      }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase" as const,
            color:
              value === opt ? "white" : "var(--color-ink-dim)",
            padding: "4px 10px",
            borderRadius: 3,
            background:
              value === opt
                ? "rgba(255,255,255,0.1)"
                : "transparent",
            boxShadow:
              value === opt
                ? "0 1px 0 rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.06)"
                : "none",
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const display =
    value >= 60
      ? value >= 1440
        ? `${value / 1440}d`
        : `${value / 60}h`
      : `${value}m`;

  const decrement = () => {
    const idx = CACHE_STEPS.indexOf(value as any);
    if (idx > 0) onChange(CACHE_STEPS[idx - 1]);
  };

  const increment = () => {
    const idx = CACHE_STEPS.indexOf(value as any);
    if (idx < CACHE_STEPS.length - 1) onChange(CACHE_STEPS[idx + 1]);
  };

  const handleStepMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
    e.currentTarget.style.color = "white";
  };

  const handleStepMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.color = "var(--color-ink-dim)";
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
        onClick={decrement}
        style={stepButtonStyle}
        onMouseEnter={handleStepMouseEnter}
        onMouseLeave={handleStepMouseLeave}
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
        {display}
      </span>
      <button
        onClick={increment}
        style={stepButtonStyle}
        onMouseEnter={handleStepMouseEnter}
        onMouseLeave={handleStepMouseLeave}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          add
        </span>
      </button>
    </div>
  );
}

export function Toggle({
  on,
  onToggle,
  disabled,
}: {
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      style={{
        position: "relative",
        width: 36,
        height: 20,
        borderRadius: 999,
        border: on
          ? "1px solid rgba(0,255,136,0.4)"
          : "1px solid var(--color-rule)",
        background: on
          ? "rgba(0,255,136,0.18)"
          : "rgba(255,255,255,0.08)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.18s ease",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: on ? "var(--color-positive)" : "var(--color-ink-dim)",
          transform: on ? "translateX(16px)" : "translateX(0)",
          boxShadow: on ? "0 0 8px rgba(0,255,136,0.5)" : "none",
          transition: "all 0.18s ease",
        }}
      />
    </button>
  );
}

export function SectionHeader({
  title,
  icon,
  aside,
}: {
  title: string;
  icon: string;
  aside?: { text: string; color: string };
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 13,
            color: "var(--color-ink-dimmer)",
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--color-ink-dim)",
          }}
        >
          {title}
        </span>
      </div>
      {aside && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: aside.color,
          }}
        >
          {aside.text}
        </span>
      )}
    </div>
  );
}

export function GhostButton({
  icon,
  label,
  onClick,
  danger,
  flex,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  flex?: boolean;
}) {
  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (danger) {
      e.currentTarget.style.background = "rgba(255,68,68,0.08)";
      e.currentTarget.style.borderColor = "rgba(255,68,68,0.5)";
    } else {
      e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
      e.currentTarget.style.color = "white";
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (danger) {
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.borderColor = "rgba(255,68,68,0.3)";
    } else {
      e.currentTarget.style.background = "transparent";
      e.currentTarget.style.borderColor = "var(--color-rule-strong)";
      e.currentTarget.style.color = "var(--color-ink)";
    }
  };

  return (
    <button
      onClick={onClick}
      style={{
        flex: flex ? 1 : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 10px",
        borderRadius: 5,
        background: "transparent",
        border: danger
          ? "1px solid rgba(255,68,68,0.3)"
          : "1px solid var(--color-rule-strong)",
        color: danger ? "var(--color-negative)" : "var(--color-ink)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase" as const,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
        {icon}
      </span>
      {label}
    </button>
  );
}