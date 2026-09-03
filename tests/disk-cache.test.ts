import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { DiskCache } from "@/src/infrastructure/cache/DiskCache";

// DiskCache roots itself at process.cwd()/.cache/<subdir>. We point cwd at a
// throwaway temp dir so the test never touches the repo's real cache.
let tmpRoot: string;
let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "diskcache-"));
  process.chdir(tmpRoot);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

/** Wait until the on-disk file for a key parses to the expected value. */
async function waitForDisk(subdir: string, key: string, predicate: (data: unknown) => boolean) {
  const safe = key.replace(/[^A-Za-z0-9._-]/g, "_");
  const file = path.join(tmpRoot, ".cache", subdir, `${safe}.json`);
  for (let i = 0; i < 100; i++) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (predicate(parsed.data)) return;
    } catch {
      /* not written yet */
    }
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error(`disk file for ${key} never reached expected state`);
}

describe("DiskCache cross-process coherence", () => {
  it("a second instance sees a fresher disk write after its own memory entry expired", async () => {
    // Two instances over the same subdir simulate two processes (UI + worker).
    const a = new DiskCache("news-uX");
    const b = new DiskCache("news-uX");

    a.set("AAPL", ["v1"], 40);
    await waitForDisk("news-uX", "AAPL", (d) => Array.isArray(d) && d[0] === "v1");

    // B reads v1 (populates B's memory) — models the UI having cached the key.
    expect(b.get<string[]>("AAPL")).toEqual(["v1"]);

    // Let B's memory entry go stale (ttl was 40ms).
    await new Promise((r) => setTimeout(r, 60));

    // A (the "worker") writes a fresher entry to the shared file.
    a.set("AAPL", ["v2"], 5_000);
    await waitForDisk("news-uX", "AAPL", (d) => Array.isArray(d) && d[0] === "v2");

    // B must now serve v2 — not its own stale v1 — via the disk re-read.
    expect(b.get<string[]>("AAPL")).toEqual(["v2"]);
    const meta = b.getWithMeta<string[]>("AAPL");
    expect(meta).toEqual({ value: ["v2"], isStale: false });
  });

  it("keeps serving a fresh in-memory entry without touching disk", () => {
    const c = new DiskCache("news-uY");
    c.set("MSFT", ["mem"], 5_000);
    // Corrupt the disk file; a fresh memory hit must not consult it.
    const file = path.join(tmpRoot, ".cache", "news-uY", "MSFT.json");
    // (write may still be in flight; overwrite is fine — get shouldn't read it)
    fs.writeFileSync(file, "GARBAGE", "utf-8");
    expect(c.get<string[]>("MSFT")).toEqual(["mem"]);
  });

  it("getWithMeta marks an entry stale when both memory and disk have expired", async () => {
    const d = new DiskCache("news-uZ");
    d.set("NVDA", ["old"], 20);
    await waitForDisk("news-uZ", "NVDA", (x) => Array.isArray(x));
    await new Promise((r) => setTimeout(r, 40));
    expect(d.getWithMeta<string[]>("NVDA")).toEqual({ value: ["old"], isStale: true });
  });
});
