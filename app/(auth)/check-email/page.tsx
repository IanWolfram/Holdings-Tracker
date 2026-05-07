"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import Link from "next/link";

function CheckEmailForm() {
  const searchParams = useSearchParams();
  const email = searchParams?.get("email") ?? "";
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [cooldown, setCooldown] = useState(0);

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setResendStatus("sending");

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      setResendStatus("error");
      return;
    }

    setResendStatus("sent");
    setCooldown(60);

    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  return (
    <div className="w-full max-w-sm mx-auto p-8">
      <div className="backdrop-blur-[var(--glass-blur)] bg-[var(--color-glass)] border border-[var(--color-glass-border)] rounded-2xl p-8 text-center">
        <h1 className="text-2xl font-[family-name:var(--font-headline)] text-[var(--color-on-surface)] mb-4">
          Check your email
        </h1>

        <p className="text-[var(--color-on-surface-variant)] mb-2">
          We sent a confirmation link to:
        </p>
        <p className="text-[var(--color-on-surface)] font-medium mb-6">
          {email || "your email address"}
        </p>

        <p className="text-sm text-[var(--color-outline)] mb-6">
          Click the link in the email to verify your account, then you&apos;ll be redirected back here.
        </p>

        {resendStatus === "sent" && (
          <p className="text-sm text-[var(--color-positive)] mb-4">
            Confirmation email resent!
          </p>
        )}
        {resendStatus === "error" && (
          <p className="text-sm text-[var(--color-negative)] mb-4">
            Failed to resend. Please try again.
          </p>
        )}

        <button
          onClick={handleResend}
          disabled={!email || cooldown > 0 || resendStatus === "sending"}
          className="text-sm text-[var(--color-positive)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cooldown > 0
            ? `Resend available in ${cooldown}s`
            : resendStatus === "sending"
              ? "Sending…"
              : "Resend confirmation email"}
        </button>

        <div className="mt-6 text-sm text-[var(--color-outline)]">
          <Link href="/login" className="hover:text-[var(--color-on-surface)] transition-colors">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-sm mx-auto p-8 text-center text-[var(--color-outline)]">Loading…</div>}>
      <CheckEmailForm />
    </Suspense>
  );
}