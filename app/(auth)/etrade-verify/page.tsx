"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ETradeVerifyPage() {
  const router = useRouter();
  const [verifier, setVerifier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/etrade/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oauth_verifier: verifier }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/world?etrade_success=true");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto p-8">
      <div className="backdrop-blur-[var(--glass-blur)] bg-[var(--color-glass)] border border-[var(--color-glass-border)] rounded-2xl p-8">
        <h1 className="text-2xl font-[family-name:var(--font-headline)] text-[var(--color-on-surface)] mb-2 text-center">
          E*Trade Verification
        </h1>
        <p className="text-sm text-[var(--color-on-surface-variant)] mb-6 text-center">
          After authorizing on E*Trade&rsquo;s site, copy the verification code
          and paste it below.
        </p>

        {success ? (
          <div className="text-center py-4">
            <p className="text-[var(--color-positive)] font-semibold">Connected!</p>
            <p className="text-sm text-[var(--color-on-surface-variant)] mt-1">Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                onChange={(e) => setVerifier(e.target.value)}
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