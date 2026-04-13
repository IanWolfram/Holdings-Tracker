"use client";

import React from "react";

export default function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 w-full z-50 glass-prominent border-t border-white/10">
      <div className="glass-reflection"></div>
      <div className="flex justify-around items-end relative z-10">
        <a className="flex flex-col items-center py-4 w-full bg-primary/10 border-t-2 border-primary" href="#">
          <span className="material-symbols-outlined text-primary text-[24px]">dashboard</span>
          <span className="text-[9px] uppercase font-bold tracking-widest text-primary mt-1.5">Terminal</span>
        </a>
        <a className="flex flex-col items-center py-4 w-full text-on-surface-variant hover:text-white transition-colors" href="#">
          <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
          <span className="text-[9px] uppercase font-bold tracking-widest mt-1.5">Holdings</span>
        </a>
        <a className="flex flex-col items-center py-4 w-full text-on-surface-variant hover:text-white transition-colors" href="#">
          <span className="material-symbols-outlined text-[24px]">monitoring</span>
          <span className="text-[9px] uppercase font-bold tracking-widest mt-1.5">Analyst</span>
        </a>
        <a className="flex flex-col items-center py-4 w-full text-on-surface-variant hover:text-white transition-colors" href="#">
          <div className="relative">
            <span className="material-symbols-outlined text-[24px]">notifications</span>
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-negative rounded-full border border-surface"></div>
          </div>
          <span className="text-[9px] uppercase font-bold tracking-widest mt-1.5">Alerts</span>
        </a>
      </div>
    </nav>
  );
}
