import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS only meaningful over HTTPS — browsers ignore it on plain HTTP, so it
  // is safe to set unconditionally.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// Wrap with Sentry for build-time source-map upload + error instrumentation.
// Safe to ship without Sentry secrets: with no SENTRY_AUTH_TOKEN the build just
// skips source-map upload (a warning, not a failure). org/project/token come
// from env (.env.sentry-build-plugin, gitignored). tunnelRoute is intentionally
// omitted — it would collide with the auth middleware's /login redirects.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "ian-wolframs-org",
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
