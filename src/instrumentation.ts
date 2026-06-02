// Next.js loads this in all runtimes (including Edge), so anything Node-only —
// like reading secrets from Supabase — must be gated behind the nodejs runtime
// check and dynamically imported so it never ends up in the Edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Hydrate secrets from Supabase `app_secrets` into process.env before any
  // request is served, so call-time reads of process.env.X see real values.
  const { hydrateSecrets } = await import("../lib/secrets");
  await hydrateSecrets();
}
