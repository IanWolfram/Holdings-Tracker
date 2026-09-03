import { describe, expect, it } from "vitest";
import { reconstructMarkdown, serializeFrontmatter, splitFrontmatter } from "@/lib/vault/store";

describe("frontmatter round-trip", () => {
  it("round-trips the value types the vault actually stores", () => {
    const fm = {
      ticker: "AAPL",
      count: 3,
      score: 0.75,
      flag: true,
      tags: ["earnings", "guidance"],
      title: 'Apple: "beats" estimates',
      nested: { a: 1, b: "two" },
    };
    const body = "## Note body\n\nSome prose.";

    const md = reconstructMarkdown(body, fm);
    const parsed = splitFrontmatter(md);

    expect(parsed.body).toBe(body);
    expect(parsed.frontmatter.ticker).toBe("AAPL");
    expect(parsed.frontmatter.count).toBe(3);
    expect(parsed.frontmatter.score).toBe(0.75);
    expect(parsed.frontmatter.flag).toBe(true);
    expect(parsed.frontmatter.tags).toEqual(["earnings", "guidance"]);
    expect(parsed.frontmatter.title).toBe('Apple: "beats" estimates');
    expect(parsed.frontmatter.nested).toEqual({ a: 1, b: "two" });
  });

  it("returns the whole content as body when there is no frontmatter", () => {
    const content = "just a plain note\nwith two lines";
    const { frontmatter, body } = splitFrontmatter(content);
    expect(frontmatter).toEqual({});
    expect(body).toBe(content);
  });

  it("reconstructs a bare body unchanged when frontmatter is empty", () => {
    expect(reconstructMarkdown("body", {})).toBe("body");
  });

  it("serializes strings containing colons in quotes so they re-parse intact", () => {
    const fm = { headline: "Fed: rates hold; markets rally" };
    const serialized = serializeFrontmatter(fm);
    const { frontmatter } = splitFrontmatter(`---\n${serialized}\n---\nx`);
    expect(frontmatter.headline).toBe("Fed: rates hold; markets rally");
  });

  it("drops null/undefined values instead of writing literal 'null'", () => {
    const serialized = serializeFrontmatter({ a: null, b: undefined, c: 1 });
    expect(serialized).toBe("c: 1");
  });
});
