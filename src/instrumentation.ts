// Next.js loads this in all runtimes (including Edge), so anything Node-only —
// like reading secrets from Supabase — must be gated behind the nodejs runtime
// check and dynamically imported so it never ends up in the Edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Hydrate secrets from Supabase `app_secrets` into process.env before any
    // request is served, so call-time reads of process.env.X see real values.
    const { hydrateSecrets } = await import("../lib/secrets");
    await hydrateSecrets();
    // Init Sentry AFTER hydration so a SENTRY_DSN stored in app_secrets is live.
    await import("../sentry.server.config");
    // Schedule the Node-only crons (prediction resolution, recalibration,
    // congress ingest, agent jobs) AFTER hydration so they see real secrets.
    // instrumentation.node.ts is not auto-loaded by Next — without this import
    // none of those crons ever run. Set PULSE_CRONS=off when the headless
    // worker (scripts/worker.ts) owns the schedules, so a UI server doesn't
    // arm a duplicate copy.
    if (process.env.PULSE_CRONS !== "off") {
      const { register: registerNodeCrons } = await import("../instrumentation.node");
      await registerNodeCrons();
    } else {
      console.info("[instrumentation] PULSE_CRONS=off — crons disabled (headless worker owns them)");
    }
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Capture errors thrown in nested React Server Components / route handlers and
// forward them to Sentry (Next.js 15+ instrumentation hook). No-op until a DSN
// is configured.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
