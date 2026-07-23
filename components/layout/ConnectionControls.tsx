import { useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import { resolveBrokerageBrand } from "@/lib/brokerages/brand";
import { openConnectionPortal } from "@/lib/snaptrade/open-portal";

interface ConnectionControlsProps {
  isConnected: boolean;
  isConnecting: boolean;
  setIsConnecting: (value: boolean) => void;
  /** Linked brokerage identity (via SnapTrade) — drives the logo + gradient. */
  brokerSlug?: string | null;
  brokerName?: string | null;
  brokerLogo?: string | null;
}

export default function ConnectionControls({
  isConnected,
  isConnecting,
  setIsConnecting,
  brokerSlug,
  brokerName,
  brokerLogo,
}: ConnectionControlsProps) {
  const [error, setError] = useState<string | null>(null);

  async function startConnect() {
    setError(null);
    setIsConnecting(true);
    try {
      const res = await authedFetch("/api/snaptrade/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.redirectURI) {
        setError(data.error || "Failed to start connection");
        setIsConnecting(false);
        return;
      }
      // Open the SnapTrade connection portal in a new tab; clear the connecting
      // flag when the user returns (the parent polls status to pick up the link).
      openConnectionPortal(data.redirectURI);
      window.addEventListener("focus", () => setIsConnecting(false), { once: true });
    } catch {
      setError("Network error");
      setIsConnecting(false);
    }
  }

  const brand = resolveBrokerageBrand(brokerSlug, brokerName);
  const label = brokerName ?? "Brokerage";

  return (
    <button
      onClick={startConnect}
      className="flex items-center gap-2.5 self-stretch px-3.5 bg-white/[0.05] hover:brightness-125 transition-all"
      title={isConnected ? `${label} connected — click to add or manage` : "Connect a brokerage"}
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
              : isConnected
                ? brand.gradientClass
                : "text-slate-400"
          }`}
        >
          {isConnecting ? "connecting…" : isConnected ? "connected" : "connect"}
        </span>
      )}
    </button>
  );
}
