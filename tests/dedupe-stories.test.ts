import { describe, expect, it } from "vitest";
import { dedupeStories, canonicalizeUrl } from "@/lib/utils/dedupeStories";
import type { ClassifiedStory } from "@/types/news.types";

function story(overrides: Partial<ClassifiedStory>): ClassifiedStory {
  return {
    ticker: "AAPL",
    headline: "Apple announces record quarterly revenue and services growth",
    summary: "Apple reported record revenue driven by iPhone and services momentum.",
    url: "https://example.com/apple-earnings",
    datetime: 1_700_000_000,
    source: "finnhub",
    verdict: "HOLD",
    confidence: 0.5,
    ...overrides,
  } as unknown as ClassifiedStory;
}

describe("canonicalizeUrl", () => {
  it("strips tracking params, www, hash, and trailing slash", () => {
    expect(canonicalizeUrl("https://www.Example.com/a/?utm_source=x&fbclid=y#frag")).toBe(
      "https://example.com/a"
    );
  });
});

describe("dedupeStories", () => {
  it("collapses the same URL from different providers into one story", () => {
    const a = story({ source: "finnhub" });
    const b = story({ source: "polygon", url: "https://example.com/apple-earnings?utm_source=feed" });
    const out = dedupeStories([a, b]);
    expect(out).toHaveLength(1);
  });

  it("collapses the same headline under different URLs", () => {
    const a = story({ url: "https://siteone.com/x" });
    const b = story({ url: "https://sitetwo.com/y" });
    const out = dedupeStories([a, b]);
    expect(out).toHaveLength(1);
  });

  it("keeps genuinely different stories", () => {
    const a = story({});
    const b = story({
      headline: "EU regulators open antitrust probe into App Store payment rules",
      summary: "The European Commission is examining Apple's App Store payment policies under the DMA.",
      url: "https://other.com/probe",
    });
    const out = dedupeStories([a, b]);
    expect(out).toHaveLength(2);
  });

  it("returns the input untouched for 0 or 1 stories", () => {
    expect(dedupeStories([])).toEqual([]);
    const single = [story({})];
    expect(dedupeStories(single)).toEqual(single);
  });
});
