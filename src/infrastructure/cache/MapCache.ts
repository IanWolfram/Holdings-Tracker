import type { ICache } from "@/src/domain/interfaces/ICache";

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

  set(key: string, value: unknown, ttlMs: number): void {
    this.store.set(key, { data: value, expiresAt: Date.now() + ttlMs });
  }
}
