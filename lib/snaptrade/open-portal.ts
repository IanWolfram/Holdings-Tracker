import { authedFetch } from "@/lib/api/client-fetch";

/**
 * Open the SnapTrade connection portal in a NEW browser tab only.
 *
 * Why this exists: callers previously did
 *   const win = window.open(url, "_blank", "noopener,noreferrer");
 *   if (!win) window.location.href = url;
 * but Chromium returns `null` from window.open whenever "noopener" is passed,
 * so the `!win` branch always fired — redirecting the *current* tab on top of
 * opening the new one (the double-navigation the user saw).
 *
 * Here we open a blank tab first (so the returned handle is a real, writable
 * same-origin window), sever `opener` for security, then navigate it. The
 * current tab is only ever redirected when the popup was genuinely blocked.
 *
 * Must be called from within a user-gesture handler (click) or the popup blocker
 * will reject it.
 */
export function openConnectionPortal(url: string): void {
  const win = window.open("about:blank", "_blank");
  if (!win) {
    // Popup blocked — the only case where we fall back to the current tab.
    window.location.href = url;
    return;
  }
  win.opener = null;
  win.location.href = url;
}

/**
 * Ask the server for a SnapTrade portal URL. Pass a connection id to open the
 * portal in repair mode for a broken (disabled) connection.
 */
export async function requestConnectionPortal(reconnect?: string): Promise<string> {
  const res = await authedFetch("/api/snaptrade/connect", {
    method: "POST",
    ...(reconnect
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reconnect }) }
      : {}),
  });
  const data = (await res.json().catch(() => ({}))) as { redirectURI?: string; error?: string };
  if (!res.ok || !data.redirectURI) {
    throw new Error(data.error ?? "Could not start the connection.");
  }
  return data.redirectURI;
}
