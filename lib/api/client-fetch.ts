/**
 * Auth-aware fetch wrapper for client-side API calls.
 * Redirects to /login on 401 responses so expired sessions don't silently fail.
 */
export async function authedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  return res;
}