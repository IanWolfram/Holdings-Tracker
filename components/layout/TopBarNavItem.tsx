import React from "react";
import Link from "next/link";

type Accent = "green" | "blue" | "red" | "orange";

const ACCENTS: Record<Accent, { color: string; glow: string }> = {
  green: { color: "var(--color-positive)", glow: "rgba(0,255,136,0.6)" },
  blue: { color: "#2f8fe6", glow: "rgba(47,143,230,0.6)" },
  red: { color: "#ff4444", glow: "rgba(255,68,68,0.6)" },
  orange: { color: "#ff8a3d", glow: "rgba(255,138,61,0.6)" },
};

interface TopBarNavItemProps {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
  accent?: Accent;
}

export default function TopBarNavItem({
  href,
  icon,
  label,
  active,
  badge,
  accent = "green",
}: TopBarNavItemProps) {
  const { color, glow } = ACCENTS[accent];

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative px-4 h-full flex items-center gap-2 transition-colors ${
        active ? "text-white" : "text-slate-400 hover:text-white"
      }`}
    >
      <span
        className="material-symbols-outlined text-[19px]"
        style={{
          color: active ? color : undefined,
          fontVariationSettings: "'FILL' 0",
        }}
      >
        {icon}
      </span>
      <span className={`font-['Inter'] text-[13px] ${active ? "font-semibold" : "font-medium"}`}>
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-3 right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black px-1 leading-none animate-pulse">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {active && (
        <span
          className="absolute left-3 right-3 bottom-0 h-0.5 rounded-t-sm"
          style={{ background: color, boxShadow: `0 0 10px ${glow}` }}
        />
      )}
    </Link>
  );
}
