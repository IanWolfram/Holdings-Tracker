let healthCache: { ok: boolean; expiresAt: number } | null = null;

export async function isOllamaHealthy(baseUrl: string): Promise<boolean> {
  if (healthCache && Date.now() < healthCache.expiresAt) return healthCache.ok;
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    });
    const ok = res.ok;
    healthCache = { ok, expiresAt: Date.now() + 30_000 };
    return ok;
  } catch {
    healthCache = { ok: false, expiresAt: Date.now() + 15_000 };
    return false;
  }
}
