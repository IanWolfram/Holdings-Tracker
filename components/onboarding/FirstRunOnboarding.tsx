"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/api/client-fetch";

// First-run activation surface. The single most important step for a new user is
// connecting a brokerage — that's what turns Pulse from a demo into *their*
// portfolio. Instead of leaving it buried in the settings panel, we surface it
// as a one-click modal the first time someone reaches the dashboard with no
// broker linked. Reuses the SnapTrade connect plumbing (/api/snaptrade/*).

const DISMISS_KEY = "pulse_onboarding_dismissed";

interface SnapStatus {
  configured: boolean;
  connected: boolean;
}

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "1", title: "Connect a brokerage", body: "Securely link E∗TRADE, Schwab, Robinhood, Fidelity and more via SnapTrade. Read-only — disconnect anytime." },
  { n: "2", title: "We read the signal", body: "News sentiment, congressional trades, insider activity and macro — fused per ticker you hold." },
  { n: "3", title: "Get accountable forecasts", body: "Directional, self-scored predictions. Informational market intelligence — not investment advice." },
];

export default function FirstRunOnboarding() {
  const [status, setStatus] = useState<SnapStatus | null>(null);
  const [dismissed, setDismissed] = useState(true); // default hidden until we confirm not-connected
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
  }, [refresh]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const res = await authedFetch("/api/snaptrade/connect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.redirectURI) {
        const win = window.open(data.redirectURI, "_blank", "noopener,noreferrer");
        // Re-check connection when the user returns from the portal tab.
        window.addEventListener("focus", () => refresh(), { once: true });
        if (!win) window.location.href = data.redirectURI;
      } else {
        window.alert(data.error ?? "Could not start the brokerage connection.");
      }
    } catch {
      window.alert("Could not start the brokerage connection.");
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

  // Show only once we KNOW SnapTrade is configured and the user has no
  // connection — and they haven't dismissed it this session.
  const visible = !dismissed && !!status && status.configured && !status.connected;
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Connect your brokerage"
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--color-rule-strong)] shadow-2xl"
        style={{ background: "linear-gradient(180deg, #131517 0%, #0c0d0f 100%)" }}
      >
        {/* top accent */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(82,196,194,0.7), transparent)" }}
        />
        <div className="p-7">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-dim)]">
            Welcome to Pulse
          </div>
          <h2 className="font-[family-name:var(--font-headline)] text-[22px] font-bold leading-tight text-white">
            Connect a brokerage to see <span className="gradient-text">your</span> portfolio
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-dim)]">
            One secure, read-only link turns Pulse into a live read on your real holdings.
            Free during beta.
          </p>

          <ol className="mt-5 space-y-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-rule-strong)] font-mono text-[11px] font-bold text-white">
                  {s.n}
                </span>
                <div>
                  <div className="font-[family-name:var(--font-headline)] text-[14px] font-semibold text-white">{s.title}</div>
                  <div className="text-[12.5px] leading-snug text-[var(--color-ink-dim)]">{s.body}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-7 flex items-center gap-3">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="flex-1 rounded-md bg-white px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-black transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {connecting ? "Opening…" : "Connect your brokerage"}
            </button>
            <button
              onClick={dismiss}
              className="rounded-md border border-[var(--color-rule-strong)] px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-ink-dim)] transition-colors hover:text-white"
            >
              Later
            </button>
          </div>
          <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--color-ink-dimmer)]">
            Powered by SnapTrade · No card required
          </p>
        </div>
      </div>
    </div>
  );
}
