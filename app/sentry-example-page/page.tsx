"use client";

// Throwaway Sentry verification page. Visit /sentry-example-page (while logged
// in) and click the button: it calls a server route that throws AND throws on
// the client, so both server + browser errors should land in Sentry Issues.
// Delete this page (and pages/api/sentry-example-api.ts) once verified.
import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

class SentryExampleFrontendError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleFrontendError";
  }
}

export default function SentryExamplePage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const triggerError = async () => {
    setError(null);
    setSent(false);
    await Sentry.startSpan({ name: "Example Frontend Span", op: "test" }, async () => {
      try {
        const res = await fetch("/api/sentry-example-api");
        if (!res.ok) {
          // Server threw — Sentry captured it server-side. Surface that here too.
          setSent(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
    // Now throw on the client so the browser SDK reports an issue as well.
    throw new SentryExampleFrontendError("Sentry example frontend error (expected).");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Sentry verification</h1>
      <p style={{ fontSize: 14, color: "#9ca3af", maxWidth: 460, margin: 0 }}>
        Clicking the button throws a server error and a client error on purpose.
        Both should appear in your Sentry Issues within ~30s. Delete this page
        afterward.
      </p>
      <button
        onClick={triggerError}
        style={{
          marginTop: 8,
          padding: "10px 20px",
          borderRadius: 6,
          border: "1px solid #2a2a2a",
          background: "#7b4ae0",
          color: "white",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Throw test error
      </button>
      {sent && <p style={{ fontSize: 12, color: "#22c55e" }}>Server error sent ✓</p>}
      {error && <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>}
    </main>
  );
}
