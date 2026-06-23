// Sentry — Node.js server runtime. Imported from src/instrumentation.ts's
// register() AFTER hydrateSecrets(), so SENTRY_DSN sourced from Supabase
// `app_secrets` is already in process.env by the time this reads it.
//
// Init is DSN-guarded: with no SENTRY_DSN the SDK stays disabled and the app
// behaves exactly as before. Set SENTRY_DSN (real env or app_secrets) to enable.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Full traces in dev, sampled in prod to control event volume / cost.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Attach local variables to stack frames for richer server stack traces.
    includeLocalVariables: true,
  });
}
