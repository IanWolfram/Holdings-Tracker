import fs from "fs";
import path from "path";
import type { ICache, CacheEntry } from "@/src/domain/interfaces/ICache";

interface Entry {
  data: unknown;
  expiresAt: number;
}

/**
 * Hybrid in-memory + disk cache.
 *
 * Reads hit memory first, fall back to disk on miss (populating memory).
 * Writes go to memory synchronously and to disk fire-and-forget via
 * tmp+rename to keep the file atomic. This survives Next.js HMR and worker
 * restarts so the dashboard can render from a warm cache instead of always
 * paying the cold-fetch cost.
 */
export class DiskCache implements ICache {
  private readonly memory = new Map<string, Entry>();
  private readonly dir: string;

  constructor(subdir: string) {
    this.dir = path.join(process.cwd(), ".cache", subdir);
    try {
      fs.mkdirSync(this.dir, { recursive: true });
    } catch (err) {
      console.warn(`[disk-cache] failed to create ${this.dir}:`, err);
    }
  }

  private filePath(key: string): string {
    const safe = key.replace(/[^A-Za-z0-9._-]/g, "_");
    return path.join(this.dir, `${safe}.json`);
  }

  get<T>(key: string): T | null {
    const entry = this.getEntry(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) return null;
    return entry.data as T;
  }

  getWithMeta<T>(key: string): CacheEntry<T> | null {
    const entry = this.getEntry(key);
    if (!entry) return null;
    const now = Date.now();
    if (now > entry.expiresAt) {
      return { value: entry.data as T, isStale: true };
    }
    return { value: entry.data as T, isStale: false };
  }

  private getEntry(key: string): Entry | null {
    const inMem = this.memory.get(key);
    if (inMem) return inMem;

    try {
      const raw = fs.readFileSync(this.filePath(key), "utf-8");
      const entry = JSON.parse(raw) as Entry;
      this.memory.set(key, entry);
      return entry;
    } catch {
      return null;
    }
  }

  set(key: string, value: unknown, ttlMs: number): void {
    const entry: Entry = { data: value, expiresAt: Date.now() + ttlMs };
    this.memory.set(key, entry);

    const target = this.filePath(key);
    const tmp = `${target}.tmp.${process.pid}.${Date.now()}`;
    fs.promises
      .writeFile(tmp, JSON.stringify(entry), "utf-8")
      .then(() => fs.promises.rename(tmp, target))
      .catch((err) => {
        console.warn(`[disk-cache] write failed for ${key}:`, err);
        fs.promises.unlink(tmp).catch(() => {});
      });
  }

  delete(key: string): void {
    this.memory.delete(key);
    try {
      fs.unlinkSync(this.filePath(key));
    } catch {}
  }
}
