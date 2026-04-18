"use client";

/**
 * Unified empty / loading / error state.
 *
 * Replaces the ~5 ad-hoc "no data" renderers sprinkled across the app.
 * Keeps the Pulse visual language: role-colored icon puck + headline +
 * optional sub + optional CTA.
 */

import type { ReactNode } from "react";

type Variant = "positive" | "negative" | "neutral" | "congress" | "loading";

interface Props {
  icon: string; // Material Symbols Outlined name
  headline: string;
  sub?: string;
  cta?: {
    label: string;
    onClick: () => void;
  };
  /** Optional arbitrary element in the CTA slot (e.g. "Next poll 0:42") */
  footer?: ReactNode;
  variant?: Variant;
  className?: string;
}

const VARIANT_STYLES: Record<Variant, { puck: string; icon: string; ring: string; spin: boolean }> = {
  positive: {
    puck: "bg-positive/[0.06]",
    ring: "border border-positive/25",
    icon: "text-positive",
    spin: false,
  },
  negative: {
    puck: "bg-negative/[0.06]",
    ring: "border border-negative/25",
    icon: "text-negative",
    spin: false,
  },
  neutral: {
    puck: "bg-white/[0.04]",
    ring: "border border-white/10",
    icon: "text-slate-400",
    spin: false,
  },
  congress: {
    puck: "bg-[#b45309]/[0.08]",
    ring: "border border-[#b45309]/25",
    icon: "text-[#b45309]",
    spin: false,
  },
  loading: {
    puck: "bg-white/[0.04]",
    ring: "border border-white/10",
    icon: "text-slate-400",
    spin: true,
  },
};

export default function EmptyState({
  icon,
  headline,
  sub,
  cta,
  footer,
  variant = "neutral",
  className = "",
}: Props) {
  const s = VARIANT_STYLES[variant];

  return (
    <div className={`flex flex-col items-center text-center px-5 py-7 gap-3 ${className}`}>
      <div
        className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${s.puck} ${s.ring}`}
      >
        <span
          className={`material-symbols-outlined text-[22px] ${s.icon} ${s.spin ? "animate-spin" : ""}`}
        >
          {icon}
        </span>
      </div>
      <h3 className="font-['Space_Grotesk'] text-sm font-bold text-white">{headline}</h3>
      {sub && <p className="text-[11px] text-slate-400 leading-relaxed max-w-[28ch]">{sub}</p>}
      {cta && (
        <button
          onClick={cta.onClick}
          className="mt-1 font-mono text-[10px] font-bold tracking-[0.14em] uppercase px-3.5 py-2 rounded-md bg-positive/[0.08] border border-positive/25 text-positive hover:bg-positive/[0.14] transition-colors"
        >
          {cta.label}
        </button>
      )}
      {footer && <div className="mt-1">{footer}</div>}
    </div>
  );
}
