import { useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";

interface ConnectionControlsProps {
  successVisible: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  setIsConnecting: (value: boolean) => void;
}

export default function ConnectionControls({
  successVisible,
  isConnected,
  isConnecting,
  setIsConnecting,
}: ConnectionControlsProps) {
  const [error, setError] = useState<string | null>(null);

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

  const connected = successVisible || isConnected;

  return (
    <button
      onClick={startAuth}
      className="flex items-center gap-2.5 self-stretch px-3.5 bg-white/[0.05] hover:brightness-125 transition-all"
      title={connected ? "E*Trade connected — click to reconnect" : "Connect E*Trade"}
    >
      <img
        src="/etrade-logo.png"
        alt="E*Trade"
        className={`w-[22px] h-[22px] object-contain transition-all ${
          isConnecting ? "animate-spin opacity-50" : ""
        } ${connected ? "" : "grayscale opacity-60 group-hover:grayscale-0"}`}
      />
      {error ? (
        <span className="font-mono text-[9px] text-negative max-w-[120px] truncate" title={error}>
          {error}
        </span>
      ) : (
        <span
          className={`hidden sm:inline font-mono pr-1.5 text-[11px] font-bold tracking-[0.02em] ${
            isConnecting
              ? "text-slate-300"
              : connected
                ? "text-etrade-gradient"
                : "text-slate-400"
          }`}
        >
          {isConnecting ? "reconnecting…" : connected ? "connected" : "connect"}
        </span>
      )}
    </button>
  );
}
