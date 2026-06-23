"use client";

// Initializes the browser Sentry SDK from a DSN passed by the server at runtime.
//
// Why not instrumentation-client.ts? That file inlines NEXT_PUBLIC_* at BUILD
// time, which can't come from Supabase `app_secrets` (hydrated at runtime). To
// keep `app_secrets` the single source of truth — no DSN in .env.local — the
// root layout (a server component) reads the hydrated `process.env.SENTRY_DSN`
// and hands it to this client component, which inits once. The DSN is public by
// design (it ships in client traffic regardless), so serializing it is fine.
import * as Sentry from "@sentry/nextjs";

let initialized = false;

export function SentryClientInit({ dsn }: { dsn: string }) {
  if (
    !initialized &&
    dsn &&
    typeof window !== "undefined" &&
    !Sentry.getClient() // don't double-init if instrumentation-client already did
  ) {
    initialized = true;
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      // Error-only Session Replay (cheap; useful for debugging the globe/dashboard).
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [Sentry.replayIntegration()],
    });
  }
  return null;
}
