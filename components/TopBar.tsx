"use client";

interface Props {
  lastUpdated: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function TopBar({ lastUpdated, refreshing, onRefresh }: Props) {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <header className="bg-[#1e2023] border-b border-white/5 sticky top-0 z-50">
      <div className="flex justify-between items-center w-full px-6 py-0">
        {/* Brand + Nav */}
        <div className="flex items-center gap-12">
          <div className="py-4">
            <h1 className="font-['Space_Grotesk'] font-black text-white text-xl leading-none">
              Pulse
            </h1>
            <p className="text-slate-500 text-[9px] uppercase tracking-widest mt-0.5">
              Precision Ledger
            </p>
          </div>
          <nav className="flex h-16 items-center">
            <a
              href="#"
              className="text-white border-b-2 border-white px-4 h-full flex items-center gap-2 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">dashboard</span>
              <span className="font-['Inter'] text-[13px] font-semibold">Terminal</span>
            </a>
            <a
              href="#"
              className="text-slate-400 px-4 h-full hover:text-slate-200 flex items-center gap-2 transition-all border-b-2 border-transparent"
            >
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              <span className="font-['Inter'] text-[13px] font-medium">Holdings</span>
            </a>
            <a
              href="#"
              className="text-slate-400 px-4 h-full hover:text-slate-200 flex items-center gap-2 transition-all border-b-2 border-transparent"
            >
              <span className="material-symbols-outlined text-[20px]">analytics</span>
              <span className="font-['Inter'] text-[13px] font-medium">Analyst</span>
            </a>
            <a
              href="#"
              className="text-slate-400 px-4 h-full hover:text-slate-200 flex items-center gap-2 transition-all border-b-2 border-transparent"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="font-['Inter'] text-[13px] font-medium">Alerts</span>
            </a>
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-6">
          {/* Market status */}
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded">
            <div
              className={`w-2 h-2 rounded-full ${
                refreshing ? "bg-blue-400 animate-pulse" : "bg-slate-300 animate-pulse"
              }`}
            />
            <span className="font-['Space_Grotesk'] text-xs tracking-tight font-medium text-slate-300 uppercase">
              {refreshing ? "Refreshing…" : "Market Open"}
            </span>
          </div>

          {/* Timestamp + refresh */}
          <div className="hidden sm:flex items-center gap-3">
            {timeStr && (
              <span className="text-slate-500 font-mono text-[10px]">{timeStr}</span>
            )}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="text-slate-400 hover:bg-white/5 p-1.5 rounded transition-colors active:scale-95 duration-100 disabled:opacity-40"
              title="Refresh"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
