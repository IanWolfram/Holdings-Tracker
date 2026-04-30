import AgentTrigger from "@/components/AgentTrigger";
import TopBarDivider from "@/components/layout/TopBarDivider";

interface ConnectionControlsProps {
  successVisible: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  setIsConnecting: (value: boolean) => void;
  timeStr: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  calibratedAt?: Date | null;
  calibrationResolved?: number;
}

export default function ConnectionControls({
  successVisible,
  isConnected,
  isConnecting,
  setIsConnecting,
  timeStr,
  onRefresh,
  refreshing,
  calibratedAt,
  calibrationResolved,
}: ConnectionControlsProps) {
  return (
    <div className="flex items-center h-full">
      <TopBarDivider />
      {calibratedAt && (
        <>
          <div
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5"
            title={`Last recalibrated: ${calibratedAt.toLocaleDateString()} — ${calibrationResolved ?? 0} resolved predictions`}
          >
            <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">calibrated</span>
            <span className="font-mono text-[11px] font-bold text-slate-300">
              {calibratedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
        </>
      )}

      <div className="flex items-center justify-center px-2 py-1.5">
        <AgentTrigger />
      </div>

      <div className="flex items-center gap-1.5 px-3 bg-white/6 border border-white/7 rounded-sm h-full">
        {successVisible || isConnected ? (
          <button
            onClick={async () => {
              setIsConnecting(true);
              try {
                await fetch("/api/etrade/trigger-terminal-auth");
                setTimeout(() => setIsConnecting(false), 15000);
              } catch {
                setIsConnecting(false);
              }
            }}
            className="font-mono text-[10px] text-positive font-bold flex items-center gap-2 hover:brightness-125 transition-all"
            title="E*Trade Connected (Click to Reconnect)"
          >
            <div className="relative flex items-center justify-center">
              <img
                src="/etrade-logo.png"
                alt="E*Trade"
                className={`w-6 h-6 object-contain ${isConnecting ? "animate-spin opacity-50" : ""}`}
              />
            </div>
            <span className="hidden sm:inline">{isConnecting ? "reconnecting..." : "connected"}</span>
          </button>
        ) : (
          <>
            <button
              disabled={isConnecting}
              onClick={async () => {
                setIsConnecting(true);
                try {
                  await fetch("/api/etrade/trigger-terminal-auth");
                  setTimeout(() => setIsConnecting(false), 10000);
                } catch {
                  setIsConnecting(false);
                }
              }}
              className={`font-mono text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-2 group ${isConnecting ? "opacity-50" : ""}`}
              title="Connect E*Trade (Starts Terminal Script)"
            >
              <img
                src="/etrade-logo.png"
                alt="E*Trade"
                className={`w-6 h-6 object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all ${isConnecting ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">{isConnecting ? "connecting..." : "connect"}</span>
            </button>
            <TopBarDivider />
            {timeStr && (
              <span className="font-mono text-[11px] font-medium text-slate-200">{timeStr}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
