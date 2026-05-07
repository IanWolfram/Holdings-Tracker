export interface CacheEntry<T> {
  value: T;
  /** True when the TTL has expired but the value is still available for stale-while-revalidate. */
  isStale: boolean;
}

export interface ICache {
  get<T>(key: string): T | null;
  /** Returns the cached value with staleness metadata. Stale entries are still
   *  returned (so callers can serve them immediately) but `isStale` signals
   *  that a background revalidation should be kicked off. */
  getWithMeta<T>(key: string): CacheEntry<T> | null;
  set(key: string, value: unknown, ttlMs: number): void;
  delete(key: string): void;
}
