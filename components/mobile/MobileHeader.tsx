"use client";

import React from "react";

interface MobileHeaderProps {
  onRefresh: () => void;
}

export default function MobileHeader({ onRefresh }: MobileHeaderProps) {
  return (
    <header className="fixed top-0 w-full z-50 glass-material border-b border-white/5">
      <div className="glass-reflection"></div>
      <div className="flex items-center justify-between px-4 py-3 relative z-10">
        <div className="flex flex-col">
          <span className="text-[14px] font-bold tracking-tight text-white font-headline leading-none">Pulse</span>
          <span className="text-[8px] uppercase tracking-[0.2em] text-on-surface-variant font-medium">Precision Ledger</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-pulse shadow-[0_0_8px_rgba(0,255,136,0.5)]"></div>
            <span className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold">Market Open</span>
          </div>
          <button onClick={onRefresh} className="flex items-center">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
}
