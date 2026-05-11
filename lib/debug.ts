const DEBUG = process.env.DEBUG === "1" || process.env.DEBUG === "true";

/**
 * Structured debug logger. Only outputs when DEBUG=1 or DEBUG=true.
 * Routes through console.log with a timestamp and namespace prefix.
 *
 * Usage:
 *   debug("agent", "Sweep complete. %d BUYS", totalBuys);
 *   debug("brain", "DeepSeek call succeeded.");
 */
export function debug(namespace: string, ...args: unknown[]) {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`[${timestamp}] [${namespace}]`, ...args);
}