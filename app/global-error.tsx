"use client";

// App Router global error boundary — catches errors in the root layout itself
// (the one place a normal error.tsx can't reach). Reports to Sentry and shows a
// minimal recovery UI. Must render its own <html>/<body>.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0a0a0a",
          color: "#e5e5e5",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: "#9ca3af", margin: 0, maxWidth: 420 }}>
          An unexpected error occurred and has been reported. You can try again.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 8,
            padding: "9px 18px",
            borderRadius: 6,
            border: "1px solid #2a2a2a",
            background: "#161616",
            color: "#e5e5e5",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
