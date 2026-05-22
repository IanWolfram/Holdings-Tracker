import type { NextApiRequest, NextApiResponse } from "next";
import { log } from "@/lib/logger";

export type ApiHandler<T = unknown> = (
  req: NextApiRequest,
  res: NextApiResponse<T>,
) => Promise<void> | void;

interface ApiError {
  error: string;
}

/**
 * Wraps an API route handler with standardized error handling, method checking,
 * and logging. Eliminates the boilerplate try/catch + res.status(500) pattern.
 *
 * @param methods - Allowed HTTP methods (e.g. ["GET", "POST"])
 * @param handler - The route handler logic
 * @param namespace - Log namespace (defaults to "api")
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
): (req: NextApiRequest, res: NextApiResponse<T | ApiError>) => Promise<void> {
  return async (req, res) => {
    if (!methods.includes(req.method ?? "")) {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      await handler(req, res as NextApiResponse<T>);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(namespace, msg);
      return res.status(500).json({ error: msg });
    }
  };
}