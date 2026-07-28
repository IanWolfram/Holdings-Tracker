import type { NextApiRequest, NextApiResponse } from "next";
import { log } from "@/lib/logger";
import { captureException, newRequestId } from "@/lib/observability";
import { rateLimit, IP_LIMIT, type RateLimitRule } from "@/lib/rate-limit";

export type ApiHandler<T = unknown> = (
  req: NextApiRequest,
  res: NextApiResponse<T>,
) => Promise<void> | void;

interface ApiError {
  error: string;
}

interface ApiHandlerOptions {
  /**
   * Coarse per-IP circuit breaker for this route. Defaults to IP_LIMIT. Pass
   * `false` to disable (e.g. webhooks), or a custom rule to tighten. This is a
   * flood guard on top of the per-user limits expensive handlers apply after
   * auth — IP limiting is anti-accident, not anti-attacker (X-Forwarded-For is
   * spoofable and proxies collapse users onto one IP), so keep it generous.
   */
  ipRateLimit?: RateLimitRule | false;
}

/** Best-effort client IP, honoring a single proxy hop via X-Forwarded-For. */
function clientIp(req: NextApiRequest): string {
  const xff = req.headers["x-forwarded-for"];
  const first = Array.isArray(xff) ? xff[0] : xff?.split(",")[0];
  return (first ?? req.socket?.remoteAddress ?? "unknown").trim();
}

/**
 * Wraps an API route handler with standardized method checking, a per-IP rate
 * limit, request IDs, and structured error capture. Eliminates the boilerplate
 * try/catch + res.status(500) pattern.
 *
 * @param methods - Allowed HTTP methods (e.g. ["GET", "POST"])
 * @param handler - The route handler logic
 * @param namespace - Log namespace / route id (defaults to "api")
 * @param options  - Per-route overrides (e.g. ipRateLimit)
 *
 * @example
 * export default apiHandler(["GET"], async (req, res) => {
 *   const data = await fetchData();
 *   res.status(200).json(data);
 * });
 */
export function apiHandler<T = unknown>(
  methods: string[],
  handler: ApiHandler<T>,
  namespace = "api",
  options: ApiHandlerOptions = {},
): (req: NextApiRequest, res: NextApiResponse<T | ApiError>) => Promise<void> {
  const ipRule = options.ipRateLimit === undefined ? IP_LIMIT : options.ipRateLimit;

  return async (req, res) => {
    if (!methods.includes(req.method ?? "")) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Coarse per-IP flood guard (per route, so one hot route can't starve others).
    if (ipRule) {
      const { allowed, retryAfterMs } = rateLimit(`ip:${clientIp(req)}:${namespace}`, ipRule);
      if (!allowed) {
        res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
        return res.status(429).json({ error: "Too many requests. Please slow down." });
      }
    }

    const requestId = newRequestId();
    res.setHeader("X-Request-Id", requestId);

    try {
      await handler(req, res as NextApiResponse<T>);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(namespace, msg);
      captureException(err, { requestId, route: namespace, method: req.method });
      if (!res.headersSent) {
        // Never leak the raw exception message to the client — it can carry
        // Postgres/SDK internals or file paths. The detail is in the log +
        // Sentry; the client gets a generic message plus the request id so a
        // report can be correlated back to the captured error.
        return res
          .status(500)
          .json({ error: `Internal server error (request ${requestId})` });
      }
    }
  };
}
