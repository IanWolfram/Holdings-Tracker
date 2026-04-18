/**
 * Manually trigger a world intelligence refresh.
 *
 * Usage:
 *   npm run world:refresh
 *   node scripts/world-refresh.mjs
 *   node scripts/world-refresh.mjs --port 3001   (if dev server is on a different port)
 *
 * Requires the Next.js dev server to be running (npm run dev).
 * Uses live E*TRADE positions only — skips if tokens are expired.
 */

const port = process.argv.includes("--port")
  ? process.argv[process.argv.indexOf("--port") + 1]
  : "3000";

const url = `http://localhost:${port}/api/world-refresh`;

console.log(`[world-refresh] POSTing to ${url} …`);

let res;
try {
  res = await fetch(url, { method: "POST" });
} catch {
  console.error(
    "[world-refresh] Could not reach the dev server. Is `npm run dev` running?"
  );
  process.exit(1);
}

const body = await res.json();

if (body.success) {
  console.log(
    `[world-refresh] Done — ${body.positions} positions refreshed at ${body.refreshedAt}`
  );
} else {
  console.error(`[world-refresh] Failed: ${body.error}`);
  process.exit(1);
}
