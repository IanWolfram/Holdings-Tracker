export interface ICache {
  get<T>(key: string): T | null;
  set(key: string, value: unknown, ttlMs: number): void;
}
