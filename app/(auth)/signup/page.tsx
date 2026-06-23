"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 10) {
      setError("Password must be at least 10 characters");
      return;
    }

    if (!accepted) {
      setError("Please accept the Terms and Disclaimer to continue");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push("/check-email?email=" + encodeURIComponent(email));
  }

  return (
    <div className="w-full max-w-sm mx-auto p-8">
      <div className="backdrop-blur-[var(--glass-blur)] bg-[var(--color-glass)] border border-[var(--color-glass-border)] rounded-2xl p-8">
        <h1 className="text-2xl font-[family-name:var(--font-headline)] text-[var(--color-on-surface)] mb-6 text-center">
          Create account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label htmlFor="password" className="block text-sm text-[var(--color-on-surface-variant)] mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] focus:outline-none focus:border-[var(--color-positive)] transition-colors"
              placeholder="Min 10 characters"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm text-[var(--color-on-surface-variant)] mb-1">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-container)] border border-[var(--color-outline-variant)] text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)] focus:outline-none focus:border-[var(--color-positive)] transition-colors"
              placeholder="Re-enter password"
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-[var(--color-on-surface-variant)] cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 accent-[var(--color-positive)]"
            />
            <span>
              I understand Pulse provides informational market intelligence only and is not
              investment advice, and I agree to the{" "}
              <Link href="/terms" target="_blank" className="text-[var(--color-positive)] hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/disclaimer" target="_blank" className="text-[var(--color-positive)] hover:underline">
                Disclaimer
              </Link>
              .
            </span>
          </label>

          {error && (
            <p className="text-sm text-[var(--color-negative)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !accepted}
            className="w-full py-2.5 rounded-lg bg-[var(--color-positive)] text-[#080808] font-semibold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--color-outline)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-positive)] hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}