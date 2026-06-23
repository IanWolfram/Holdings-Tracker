/**
 * Lightweight error/observability seam.
 *
 * Single choke point for server error reporting: always emits structured JSON to
 * stderr (captured in .pm2/logs), and additionally forwards to Sentry when it's
 * been initialized (a SENTRY_DSN is configured — see sentry.server.config.ts).
 * Call sites (e.g. api-handler) never change regardless of backend.
 */
import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";

export function newRequestId(): string {
  return randomUUID().slice(0, 8);
}

export interface ErrorContext {
  requestId?: string;
  route?: string;
  userId?: string;
  method?: string;
  [k: string]: unknown;
}

/**
 * Report a server error. Structured so logs are greppable and a Sentry/OTel
 * backend can be dropped in here without touching call sites.
 *
 * Sentry is wired via @sentry/nextjs; it activates only once a SENTRY_DSN is
 * set. Until then this is the structured-log fallback (no events are sent).
 */
export function captureException(err: unknown, ctx: ErrorContext = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const payload = {
    level: "error",
    message,
    ...ctx,
    ...(stack ? { stack } : {}),
    at: new Date().toISOString(),
  };
  // Single line of JSON → easy to grep / ship to a log drain.
  console.error(`[error] ${JSON.stringify(payload)}`);

  // Forward to Sentry only when it's actually initialized (DSN configured);
  // getClient() returns undefined otherwise, so this is a safe no-op.
  try {
    if (Sentry.getClient()) {
      Sentry.captureException(err, { extra: { ...ctx } });
    }
  } catch {
    /* never let error reporting throw */
  }
}
