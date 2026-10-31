import { useState } from "react";
import { resolveBrokerageBrand } from "@/lib/brokerages/brand";
import { openConnectionPortal, requestConnectionPortal } from "@/lib/snaptrade/open-portal";

interface ConnectionControlsProps {
  isConnected: boolean;
  isConnecting: boolean;
  setIsConnecting: (value: boolean) => void;
  /** Linked brokerage identity (via SnapTrade) — drives the logo + gradient. */
  brokerSlug?: string | null;
  brokerName?: string | null;
  brokerLogo?: string | null;
  /** When set, the shown brokerage's connection is broken; clicking repairs it. */
  brokenConnectionId?: string | null;
}

export default function ConnectionControls({
  isConnected,
  isConnecting,
  setIsConnecting,
  brokerSlug,
  brokerName,
  brokerLogo,
  brokenConnectionId,
}: ConnectionControlsProps) {
  const needsReconnect = isConnected && !!brokenConnectionId;
  const [error, setError] = useState<string | null>(null);

  async function startConnect() {
    setError(null);
    setIsConnecting(true);
    try {
      // Open the SnapTrade portal in a new tab (repair mode for a broken
      // connection); clear the connecting flag when the user returns (the
      // parent polls status to pick up the change).
      openConnectionPortal(await requestConnectionPortal(brokenConnectionId ?? undefined));
      window.addEventListener("focus", () => setIsConnecting(false), { once: true });
    } catch (err) {
      setError((err as Error).message || "Failed to start connection");
      setIsConnecting(false);
    }
  }

  const brand = resolveBrokerageBrand(brokerSlug, brokerName);
  const label = brokerName ?? "Brokerage";

  return (
    <button
      onClick={startConnect}
      className="flex items-center gap-2.5 self-stretch px-3.5 bg-white/[0.05] hover:brightness-125 transition-all"
      title={
        needsReconnect
          ? `${label} connection is broken — holdings may be out of date. Click to reconnect.`
          : isConnected
            ? `${label} connected — click to add or manage`
            : "Connect a brokerage"
      }
    >
      {isConnected ? (
        <img
          src={brand.logoSrc}
          alt={label}
          onError={(e) => {
            // Local keyed copy missing → fall back to SnapTrade's remote logo,
            // then hide (avoid an infinite onError loop).
            const img = e.currentTarget;
            if (brokerLogo && img.src !== brokerLogo) img.src = brokerLogo;
            else img.style.display = "none";
          }}
          className={`w-[20px] h-[20px] object-contain transition-all ${
            isConnecting ? "animate-pulse opacity-50" : ""
          }`}
        />
      ) : (
        <span
          className={`material-symbols-outlined text-[18px] text-slate-400 ${
            isConnecting ? "animate-pulse" : ""
          }`}
        >
          account_balance
        </span>
      )}
      {error ? (
        <span className="font-mono text-[9px] text-negative max-w-[120px] truncate" title={error}>
          {error}
        </span>
      ) : (
        <span
          className={`hidden sm:inline font-mono pr-1.5 text-[11px] font-bold tracking-[0.02em] ${
            isConnecting
              ? "text-slate-300"
              : needsReconnect
                ? "text-[#eab308]"
                : isConnected
                  ? brand.gradientClass
                  : "text-slate-400"
          }`}
        >
          {isConnecting ? "connecting…" : needsReconnect ? "reconnect" : isConnected ? "connected" : "connect"}
        </span>
      )}
    </button>
  );
}
