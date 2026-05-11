import { SLOW_API_TIMEOUT_MS } from "./constants";

/**
 * Reject obviously-private hostnames before sending to Jina. Jina itself
 * fetches the URL server-side, so a user-controlled URL that points at an
 * internal address (RFC1918, link-local, loopback, metadata endpoints) would
 * turn our endpoint into an SSRF gadget. This is best-effort — Jina also
 * applies its own safeguards.
 */
function isPublicHttpUrl(raw: string): boolean {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return false; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  // Block literal IPs that resolve into private/reserved ranges.
  const blockedHostExact = new Set([
    "localhost", "ip6-localhost", "ip6-loopback",
    "metadata.google.internal",
  ]);
  if (blockedHostExact.has(host)) return false;
  if (host.endsWith(".internal") || host.endsWith(".local")) return false;
  // IPv4 literal check
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 0) return false;
    if (a === 169 && b === 254) return false; // link-local + AWS metadata
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a >= 224) return false; // multicast / reserved
  }
  // IPv6 loopback / link-local / unique-local
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return false;
  return true;
}

export async function fetchFullArticleContent(url: string): Promise<string | null> {
  if (!url?.trim()) {
    console.warn("[jina] Skipping extraction for empty URL");
    return null;
  }
  if (!isPublicHttpUrl(url)) {
    console.warn("[jina] Refusing to fetch non-public URL");
    return null;
  }
  try {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const res = await fetch(jinaUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(SLOW_API_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data?.content as string) || null;
  } catch (err) {
    console.error("[jina] Extraction failed:", err);
    return null;
  }
}
