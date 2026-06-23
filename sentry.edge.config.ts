// Sentry — Edge runtime (middleware.ts and any edge routes). The edge runtime
// can't read Supabase `app_secrets` (no hydrateSecrets there), so SENTRY_DSN
// must be a real env var for edge errors to report; otherwise this no-ops and
// server (Node) + client reporting still work fine.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}
