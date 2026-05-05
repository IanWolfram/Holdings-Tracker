export async function fetchFullArticleContent(url: string): Promise<string | null> {
  if (!url?.trim()) {
    console.warn("[jina] Skipping extraction for empty URL");
    return null;
  }
  try {
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
    const res = await fetch(jinaUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data?.content as string) || null;
  } catch (err) {
    console.error("[jina] Extraction failed:", err);
    return null;
  }
}
