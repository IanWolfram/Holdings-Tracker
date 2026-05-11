"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api/client-fetch";

const VERIFIER_RE = /^[A-Za-z0-9._~-]{4,64}$/;

export default function ETradeVerifyPage() {
  const router = useRouter();
  const [verifier, setVerifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [clipboardHint, setClipboardHint] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const submit = useCallback(async (code: string) => {
    if (submittingRef.current || !code) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);

    try {
      const res = await authedFetch("/api/etrade/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oauth_verifier: code }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        submittingRef.current = false;
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/terminal?etrade_success=true"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Try to read verifier from clipboard — called on mount and when tab regains focus
  const tryClipboard = useCallback(async () => {
    if (submittingRef.current || success) return;
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (VERIFIER_RE.test(trimmed)) {
        setVerifier(trimmed);
        setClipboardHint("Code detected from clipboard — submitting…");
        submit(trimmed);
      }
    } catch {
      // Clipboard permission denied or unavailable — user types manually
    }
  }, [submit, success]);

  useEffect(() => {
    // Try immediately on mount (user may have already copied the code)
    tryClipboard();

    // Also try when the user switches back to this tab after copying from E*TRADE
    const onFocus = () => tryClipboard();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [tryClipboard]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(verifier);
  }

  return (
    <div className="w-full max-w-sm mx-auto p-8">
      <div className="backdrop-blur-[var(--glass-blur)] bg-[var(--color-glass)] border border-[var(--color-glass-border)] rounded-2xl p-8">
        <h1 className="text-2xl font-[family-name:var(--font-headline)] text-[var(--color-on-surface)] mb-2 text-center">
          E*Trade Verification
        </h1>
        <p className="text-sm text-[var(--color-on-surface-variant)] mb-6 text-center">
          Copy the code from E*Trade — it will be detected automatically.
        </p>

        {success ? (
          <div className="text-center py-4">
            <p className="text-[var(--color-positive)] font-semibold">Connected!</p>
            <p className="text-sm text-[var(--color-on-surface-variant)] mt-1">Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {clipboardHint && !error && (
              <p className="text-xs text-[var(--color-positive)] text-center">{clipboardHint}</p>
            )}

            <div>
              <label
                htmlFor="verifier"
                className="block text-sm text-[var(--color-on-surface-variant)] mb-1"
              >
                Verification Code
              </label>
              <input
                id="verifier"
                type="text"
                required
                value={verifier}
                onChange={(e) => { setVerifier(e.target.value); setClipboardHint(null); }}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] focus:outline-none focus:border-[var(--color-positive)] transition-colors font-mono text-center text-lg tracking-widest"
                placeholder="ABC123"
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-[var(--color-negative)]">{error}</p>}

            <button
              type="submit"
              disabled={loading || !verifier}
              className="w-full py-2.5 rounded-lg bg-[var(--color-positive)] text-[#080808] font-semibold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Connecting..." : "Connect"}
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <button
            onClick={() => router.push("/world")}
            className="text-sm text-[var(--color-outline)] hover:text-[var(--color-on-surface)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}