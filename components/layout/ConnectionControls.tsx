import { useCallback, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import AccountIconDiv from "@/components/layout/AccountIconDiv";
import TopBarDivider from "@/components/layout/TopBarDivider";
import AgentTrigger from "@/components/triggers/AgentTrigger";

interface ConnectionControlsProps {
  successVisible: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  setIsConnecting: (value: boolean) => void;
  timeStr: string | null;
  onRefresh: () => void;
  refreshing: boolean;
  accountPanelOpen: boolean;
  setAccountPanelOpen: (open: boolean) => void;
}

export default function ConnectionControls({
  successVisible,
  isConnected,
  isConnecting,
  setIsConnecting,
  timeStr,
  onRefresh,
  refreshing,
  accountPanelOpen,
  setAccountPanelOpen,
}: ConnectionControlsProps) {
  const [error, setError] = useState<string | null>(null);

  const openAccountPanel = useCallback(() => setAccountPanelOpen(true), [setAccountPanelOpen]);

  async function startAuth() {
    setError(null);
    setIsConnecting(true);
    try {
      const res = await authedFetch("/api/etrade/auth");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start auth");
        setIsConnecting(false);
        return;
      }
      // Open E*TRADE auth in a new tab, then navigate to the verify page
      window.open(data.authUrl, "_blank", "noopener,noreferrer");
      window.location.href = "/etrade-verify";
    } catch {
      setError("Network error");
      setIsConnecting(false);
    }
  }

  return (
    <div className="flex items-center h-full">
      <TopBarDivider />

      <div className="flex items-center justify-center px-2 py-1.5">
        <AgentTrigger />
      </div>

      <div className="flex items-center justify-between gap-3 pl-3 pr-0 py-1.5 bg-white/6 border border-white/7 rounded-sm h-full">
        {successVisible || isConnected ? (
          <button
            onClick={startAuth}
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
              onClick={startAuth}
              className={`font-mono text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-2 group ${isConnecting ? "opacity-50" : ""}`}
              title="Connect E*Trade"
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
        {error && (
          <span className="font-mono text-[9px] text-negative max-w-[120px] truncate" title={error}>
            {error}
          </span>
        )}
        <AccountIconDiv onClick={openAccountPanel} isOpen={accountPanelOpen} />
      </div>
    </div>
  );
}