// Sentry — browser runtime (Next.js 15+ client instrumentation file).
//
// Primary client init is runtime-injected from the server (see
// components/providers/SentryClientInit.tsx) so the DSN can come from Supabase
// `app_secrets`, our single source of truth. This file is an OPTIONAL fallback:
// if you'd rather inline the DSN at build time, set NEXT_PUBLIC_SENTRY_DSN
// (NEXT_PUBLIC_* is build-time only — it CANNOT come from app_secrets). With
// neither, this no-ops and SentryClientInit handles init. The two are mutually
// guarded by Sentry.getClient() so they never double-init.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn && !Sentry.getClient()) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Session Replay: only record sessions that hit an error (cheap, useful for
    // debugging the dashboard/globe). Bump replaysSessionSampleRate to sample
    // healthy sessions too.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
  });
}

// App Router navigation instrumentation — lets Sentry tie spans to client-side
// route transitions. Re-exported for Next.js to pick up.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
