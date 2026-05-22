/**
 * Minimal structured logger for server-side use.
 * Uses console.error/warn/info so ESLint's no-console rule (which allows
 * error/warn/info but blocks console.log) stays happy.
 */
export const log = {
  error: (ns: string, msg: string, ...args: unknown[]) =>
    console.error(`[${ns}]`, msg, ...args),
  warn: (ns: string, msg: string, ...args: unknown[]) =>
    console.warn(`[${ns}]`, msg, ...args),
  info: (ns: string, msg: string, ...args: unknown[]) =>
    console.info(`[${ns}]`, msg, ...args),
};