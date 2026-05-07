"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    setSent(true);
  }

  return (
    <div className="w-full max-w-sm mx-auto p-8">
      <div className="backdrop-blur-[var(--glass-blur)] bg-[var(--color-glass)] border border-[var(--color-glass-border)] rounded-2xl p-8">
        <h1 className="text-2xl font-[family-name:var(--font-headline)] text-[var(--color-on-surface)] mb-4 text-center">
          Reset password
        </h1>

        {sent ? (
          <div className="text-center">
            <p className="text-[var(--color-on-surface-variant)] mb-4">
              If an account exists for <span className="text-[var(--color-on-surface)] font-medium">{email}</span>,
              you&apos;ll receive a password reset link shortly.
            </p>
            <Link href="/login" className="text-sm text-[var(--color-positive)] hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            <div>
              <label htmlFor="email" className="block text-sm text-[var(--color-on-surface-variant)] mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] focus:outline-none focus:border-[var(--color-positive)] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--color-negative)]">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[var(--color-positive)] text-[#080808] font-semibold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-[var(--color-outline)] hover:text-[var(--color-on-surface)] transition-colors">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}