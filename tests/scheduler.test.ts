import { describe, expect, it } from "vitest";
import { computeNextRun } from "@/lib/agent/scheduler";

const TZ = "America/New_York";

describe("computeNextRun", () => {
  it("returns null for malformed cron expressions", () => {
    expect(computeNextRun("not a cron", TZ)).toBeNull();
    expect(computeNextRun("* * *", TZ)).toBeNull();
    expect(computeNextRun("", TZ)).toBeNull();
  });

  it("finds the next */15 slot within 15 minutes, aligned to a quarter hour", () => {
    const next = computeNextRun("*/15 * * * *", TZ);
    expect(next).not.toBeNull();
    const deltaMs = next!.getTime() - Date.now();
    expect(deltaMs).toBeGreaterThan(0);
    expect(deltaMs).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(next!.getUTCMinutes() % 15).toBe(0);
    expect(next!.getUTCSeconds()).toBe(0);
  });

  it("schedules a daily cron at the requested hour in the given timezone", () => {
    const next = computeNextRun("30 8 * * *", TZ);
    expect(next).not.toBeNull();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(next!);
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    expect(hour).toBe("08");
    expect(minute).toBe("30");
    // Within the next 24h.
    expect(next!.getTime() - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});
