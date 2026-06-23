// Throwaway Sentry verification route. Deliberately throws so Sentry's Next.js
// instrumentation (onRequestError) captures a server-side error. Not wrapped in
// apiHandler on purpose — we want the raw throw to reach Sentry's auto-capture.
// Delete this with app/sentry-example-page/page.tsx once verified.
import type { NextApiRequest, NextApiResponse } from "next";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

export default function handler(_req: NextApiRequest, _res: NextApiResponse) {
  throw new SentryExampleAPIError("Sentry example API error (expected, raised on the backend).");
}
