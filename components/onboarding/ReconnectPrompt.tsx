"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import { openConnectionPortal } from "@/lib/snaptrade/open-portal";
import { resolveBrokerageBrand } from "@/lib/brokerages/brand";

// Disconnect recovery surface. A SnapTrade brokerage connection can silently
// break — the auth expires, the broker revokes it, or the user changes their
// password — and SnapTrade then flags that authorization `disabled`. The rail
// still reads "connected" (the authorization is still listed), but no positions
// flow, so the dashboard looks empty for no obvious reason.
//
// This popup catches exactly that state: registered, but every connection is
// disabled. It names the user's last-used brokerage and offers a one-click
// reconnect that reopens the SnapTrade portal (new tab only). Never fires for a
// never-connected user — that's FirstRunOnboarding's job (fires on !connected).

const DISMISS_KEY = "pulse_reconnect_dismissed";

interface Connection {
  name: string;
  slug?: string | null;
  logo?: string | null;
  disabled: boolean;
}
interface SnapStatus {
  configured: boolean;
  registered: boolean;
  connected: boolean;
  connections: Connection[];
}

export default function ReconnectPrompt() {
  const [status, setStatus] = useState<SnapStatus | null>(null);
  const [dismissed, setDismissed] = useState(true); // hidden until we confirm the state
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await authedFetch("/api/snaptrade/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      /* ignore — never block the dashboard on this */
    }
  }, []);

  useEffect(() => {
    const alreadyDismissed =
      typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1";
    if (!alreadyDismissed) setDismissed(false);
    refresh();
    // Re-check whenever the user returns to the tab (e.g. back from the portal).
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const handleReconnect = useCallback(async () => {
    setConnecting(true);
    try {
      const res = await authedFetch("/api/snaptrade/connect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.redirectURI) {
        openConnectionPortal(data.redirectURI);
        // Re-check once the user comes back from the portal tab.
        window.addEventListener("focus", () => refresh(), { once: true });
      } else {
        window.alert(data.error ?? "Could not start the reconnection.");
      }
    } catch {
      window.alert("Could not start the reconnection.");
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const conns = status?.connections ?? [];
  // Disconnected == registered, has authorizations, but every one is disabled.
  const disconnected =
    !!status &&
    status.configured &&
    status.registered &&
    conns.length > 0 &&
    conns.every((c) => c.disabled);

  // Clear a stale session-dismiss once the connection is healthy again, so a
  // *future* disconnect in the same session still surfaces the prompt.
  useEffect(() => {
    if (status && !disconnected) {
      try {
        window.sessionStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [status, disconnected]);

  const visible = !dismissed && disconnected;
  if (!visible) return null;

  // Last-used provider — the (disabled) authorization carries its brand.
  const last = conns.find((c) => c.name) ?? conns[0];
  const brand = resolveBrokerageBrand(last?.slug, last?.name);
  const providerName = last?.name ?? "your brokerage";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Reconnect your brokerage"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-rule-strong)] shadow-2xl"
        style={{ background: "linear-gradient(180deg, #131517 0%, #0c0d0f 100%)" }}
      >
        {/* top accent — amber, signalling a broken/attention state */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(234,179,8,0.75), transparent)" }}
        />
        <div className="p-7">
          <div className="flex items-center gap-3">
            <img
              src={brand.logoSrc}
              alt={providerName}
              onError={(e) => {
                const img = e.currentTarget;
                if (last?.logo && img.src !== last.logo) img.src = last.logo;
                else img.style.display = "none";
              }}
              className="h-7 w-7 flex-shrink-0 object-contain"
            />
            <div className="mb-0 font-mono text-[10px] uppercase tracking-[0.18em] text-[#eab308]">
              Connection lost
            </div>
          </div>

          <h2 className="mt-4 font-[family-name:var(--font-headline)] text-[20px] font-bold leading-tight text-white">
            Reconnect to <span className="gradient-text">{providerName}</span>
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-dim)]">
            Your link to {providerName} expired or was revoked, so Pulse can&apos;t read
            your live holdings. Reconnect to restore your portfolio — it only takes a
            moment.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleReconnect}
              disabled={connecting}
              className="flex-1 rounded-md bg-white px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-black transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {connecting ? "Opening…" : `Reconnect ${providerName}`}
            </button>
            <button
              onClick={dismiss}
              className="rounded-md border border-[var(--color-rule-strong)] px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-ink-dim)] transition-colors hover:text-white"
            >
              Later
            </button>
          </div>
          <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-ink-dimmer)]">
            Secure re-link via SnapTrade
          </p>
        </div>
      </div>
    </div>
  );
}
