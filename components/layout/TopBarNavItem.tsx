import React from "react";
import Link from "next/link";

interface TopBarNavItemProps {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
}

export default function TopBarNavItem({ href, icon, label, active, badge }: TopBarNavItemProps) {
  return (
    <Link
      href={href}
      className={`px-4 h-full flex items-center gap-2 transition-all border-b-2 relative ${
        active
          ? "text-white border-white"
          : "text-slate-400 border-transparent hover:text-slate-200"
      }`}
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      <span
        className={`font-['Inter'] text-[13px] ${active ? "font-semibold" : "font-medium"}`}
      >
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-3 right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-black px-1 leading-none animate-pulse">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
