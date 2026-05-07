import type { ICache, CacheEntry } from "@/src/domain/interfaces/ICache";

export class MapCache implements ICache {
  private readonly store = new Map<string, { data: unknown; expiresAt: number }>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  getWithMeta<T>(key: string): CacheEntry<T> | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const now = Date.now();
    if (now > entry.expiresAt) {
      // Expired — return as stale so callers can still serve it
      return { value: entry.data as T, isStale: true };
    }
    return { value: entry.data as T, isStale: false };
  }

  set(key: string, value: unknown, ttlMs: number): void {
    this.store.set(key, { data: value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}