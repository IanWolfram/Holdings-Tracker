import { getVaultIndex, updateVaultIndex } from "../lib/vault-index";
import { appendVaultLog } from "./vault-meta";
import type { GeoStory, WorldData } from "@/types/geo.types";
import type { EventsSnapshot } from "../lib/marketdata/events";
import type { MacroSnapshot } from "../lib/marketdata/macro";
import type { VaultStore } from "@/lib/vault/store";

function computeDecayScore(storyDateMs: number, nowMs: number = Date.now()): number {
  // exp(-age_days / 7): a 1-week-old note is at ~0.37, a month is ~0.013.
  const ageDays = Math.max(0, (nowMs - storyDateMs) / 86_400_000);
  return Math.max(0, Math.min(1, Math.exp(-ageDays / 7)));
}

function formatSummary(summary: string | undefined): string {
  if (!summary) return "_No summary available._";
  const trimmed = summary.trim();
  if (!trimmed) return "_No summary available._";
  // Detect truncation: doesn't end with sentence-ending punctuation
  const lastChar = trimmed[trimmed.length - 1];
  if (!/[.!?"]/.test(lastChar)) {
    return trimmed + "…";
  }
  return trimmed;
}

function buildNoteContent(story: GeoStory, dateStr: string, sector?: string): string {
  const decayScore = computeDecayScore(story.datetime * 1000);
  const isFailed = story.analysisFailed ?? false;
  const isVerified = (story.isAnalyzed ?? false) && !isFailed;
  return [
    "---",
    `date: "${dateStr}"`,
    `ticker: ${story.ticker}`,
    ...(sector ? [`sector: ${sector}`] : []),
    `verdict: ${story.verdict}`,
    `confidence: ${story.confidence.toFixed(2)}`,
    `relevance: ${story.relevanceScore.toFixed(2)}`,
    `decayScore: ${decayScore.toFixed(4)}`,
    `verified: ${isVerified}`,
    `analysisFailed: ${isFailed}`,
    `country: ${story.originCountryCode ?? "unknown"}`,
    `source: ${story.source}`,
    `url: "${story.url}"`,
    `headline: "${story.headline.replace(/"/g, '\\"')}"`,
    ...(story.catalystTypes && story.catalystTypes.length > 0
      ? ["catalystTypes:", ...story.catalystTypes.map((type) => `  - ${type}`)]
      : []),
    "tags:",
    ...[
      "news",
      story.ticker.toLowerCase(),
      story.verdict.toLowerCase(),
      "world-brain",
      ...(sector ? [sector.toLowerCase().replace(/\s+/g, "-")] : []),
      ...(story.catalystTypes?.map((type) => `catalyst-${type}`) ?? []),
      ...(isVerified ? ["m5-verified"] : []),
      ...(isFailed ? ["analysis-failed"] : []),
    ].map((t) => `  - ${t}`),
    "---",
    "",
    `# ${story.headline}`,
    "",
    `**Verdict**: ${story.verdict} (${Math.round(story.confidence * 100)}% confidence)  `,
    `**Relevance to [[${story.ticker}]]**: ${Math.round(story.relevanceScore * 100)}%  `,
    `**Geographic origin**: ${story.originCountryCode ?? "Unknown"}  `,
    "",
    "## Summary",
    formatSummary(story.summary),
    "",
    "## AI Analysis",
    isFailed
      ? "> **Analysis failed.** Default HOLD at 50%. Do not use for pattern learning."
      : (story.reason
          ? story.reason
          : story.classificationSource === "ai"
            ? "_No analysis available._"
            : "> **Keyword-screened verdict** — full AI analysis pending. Treat this verdict as a low-confidence keyword signal, not a reasoned call."),
    "",
    "## Links",
    `- [Source Article](${story.url})`,
    `- [[${story.ticker}]]`,
    ...(story.catalystTypes?.map((type) => `- [[catalysts/${type}]]`) ?? []),
    ...(story.originCountryCode ? [`- [[${story.originCountryCode}-news]]`] : []),
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Individual story note
// ---------------------------------------------------------------------------

export async function writeStoryNote(
  story: GeoStory,
  store: VaultStore,
  sector?: string,
  userId: string = "system",
): Promise<void> {
  try {
    const date = new Date(story.datetime * 1000);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
    const slug = story.headline
      .slice(0, 50)
      .replace(/[^a-z0-9]/gi, "-")
      .replace(/-+/g, "-")
      .toLowerCase();
    const noteRelPath = `news/${dateStr}-${slug}.md`;
    const content = buildNoteContent(story, dateStr, sector);

    // If a file for this URL already exists (possibly under a different slug), use that path
    // and skip if it's already verified — don't downgrade an AI-verified entry.
    // Optimized duplicate check using the Vault Index
    const index = await getVaultIndex(store, userId);
    const existing = index.get(story.url);
    if (existing) {
      // Don't overwrite a successful analysis with a failed one
      if (existing.isAnalyzed && (story.analysisFailed ?? false)) return;
      if (existing.isAnalyzed && !story.isAnalyzed) return;
      // Skip if content is identical (simplified check)
      if (existing.verdict === story.verdict && existing.isAnalyzed === !!story.isAnalyzed) {
        return;
      }
      await store.write(existing.filePath, content);
      updateVaultIndex(
        story.url,
        {
          verdict: story.verdict,
          confidence: story.confidence,
          reason: story.reason,
          relevanceScore: story.relevanceScore,
          originCountryCode: story.originCountryCode || null,
          catalystTypes: story.catalystTypes,
          classifiedAt: dateStr,
          isAnalyzed: !!story.isAnalyzed,
          fromVault: true,
          filePath: existing.filePath,
          ticker: story.ticker,
          headline: story.headline,
          summary: story.summary ?? "",
          datetime: story.datetime,
          source: story.source,
        },
        userId,
      );
      return;
    }

    await store.write(noteRelPath, content);

    // Update index so subsequent writes in this process know about the new file
    updateVaultIndex(
      story.url,
      {
        verdict: story.verdict,
        confidence: story.confidence,
        reason: story.reason,
        relevanceScore: story.relevanceScore,
        originCountryCode: story.originCountryCode || null,
        catalystTypes: story.catalystTypes,
        classifiedAt: dateStr,
        isAnalyzed: !!story.isAnalyzed,
        fromVault: true,
        filePath: noteRelPath,
        ticker: story.ticker,
        headline: story.headline,
        summary: story.summary ?? "",
        datetime: story.datetime,
        source: story.source,
      },
      userId,
    );
  } catch (err) {
    console.error("[obsidian] Failed to write story note:", err);
  }
}

// ---------------------------------------------------------------------------
// Daily summary note
// ---------------------------------------------------------------------------

export async function writeDailySummary(
  date: string,
  stories: GeoStory[],
  store: VaultStore,
  baseData: WorldData
): Promise<void> {
  try {
    // Group by sector, then by ticker
    const bySector: Record<string, Record<string, GeoStory[]>> = {};
    for (const story of stories) {
      const profile = (baseData as WorldData)?.profiles?.[story.ticker];
      const sector = profile?.sector ?? "Mixed / Uncategorized";
      bySector[sector] ??= {};
      bySector[sector][story.ticker] ??= [];
      bySector[sector][story.ticker].push(story);
    }

    const sectors = Object.keys(bySector).sort();

    // Read prior story count (if any) so we only log when the count changes.
    let priorStoryCount = -1;
    try {
      const existing = await store.readNote(`daily/${date}.md`);
      if (existing) {
        const m = existing.body.match(/Covering \*\*(\d+) stories\*\*/);
        if (m) priorStoryCount = parseInt(m[1], 10);
      }
    } catch { /* fall through */ }

    const content = [
      "---",
      `date: "${date}"`,
      "type: daily-summary",
      "tags:",
      "  - daily",
      "  - summary",
      "  - world-brain",
      "---",
      "",
      `# Daily World Summary — ${date}`,
      "",
      `> Covering **${stories.length} stories** across **${Object.keys(bySector).length} sectors**`,
      "",
      ...sectors.flatMap((sector) => {
        const tickersInSector = bySector[sector];
        const tickerNames = Object.keys(tickersInSector).sort();

        return [
          `## 📁 ${sector.toUpperCase()}`,
          "",
          ...tickerNames.flatMap((ticker) => {
            const ss = tickersInSector[ticker];
            const nonFailed = ss.filter((s) => !(s.analysisFailed ?? false));
            const failedCount = ss.length - nonFailed.length;
            const buys = nonFailed.filter((s) => s.verdict === "BUY").length;
            const sells = nonFailed.filter((s) => s.verdict === "SELL").length;
            const headerSuffix = failedCount > 0 ? ` (${failedCount} analysis failure${failedCount > 1 ? "s" : ""})` : "";
            return [
              `### [[${ticker}]] — ${ss.length} stories (${buys} BUY / ${sells} SELL)${headerSuffix}`,
              "",
              ...ss.map(
                (s) => {
                  const failedTag = (s.analysisFailed ?? false) ? " *(analysis failed)*" : "";
                  return `- **${s.verdict}** (${Math.round(s.confidence * 100)}%) — [${s.headline}](${s.url})${failedTag}`;
                }
              ),
              "",
            ];
          })
        ];
      }),
    ].join("\n");

    await store.write(`daily/${date}.md`, content);

    if (priorStoryCount !== stories.length) {
      const tickerCount = Object.values(bySector).reduce(
        (acc, byTicker) => acc + Object.keys(byTicker).length,
        0
      );
      const delta =
        priorStoryCount === -1
          ? "new"
          : `+${stories.length - priorStoryCount}`;
      await appendVaultLog(store, {
        type: "daily",
        title: `Daily summary updated for ${date} (${delta})`,
        details: `${stories.length} stories across ${sectors.length} sectors, ${tickerCount} tickers.`,
      });
    }
  } catch (err) {
    console.error("[obsidian] Failed to write daily summary:", err);
  }
}

function macroValue(value: number | null): string {
  return value === null ? "null" : value.toFixed(2);
}

export async function writeMacroSnapshot(
  date: string,
  snapshot: MacroSnapshot,
  store: VaultStore,
  commentary?: string
): Promise<void> {
  try {
    const content = [
      "---",
      `date: "${date}"`,
      "type: macro-snapshot",
      `regime: ${snapshot.regime}`,
      `vix: ${macroValue(snapshot.vix)}`,
      `tenY: ${macroValue(snapshot.tenY)}`,
      `dxy: ${macroValue(snapshot.dxy)}`,
      `dxyTrend: ${snapshot.dxyTrend}`,
      `fedFunds: ${macroValue(snapshot.fedFunds)}`,
      `cpi: ${macroValue(snapshot.cpi)}`,
      "tags:",
      "  - macro",
      "  - world-brain",
      "---",
      "",
      `# Macro Snapshot - ${date}`,
      "",
      `Regime: ${snapshot.regime}`,
      `VIX: ${snapshot.vix === null ? "n/a" : snapshot.vix.toFixed(2)}`,
      `10Y: ${snapshot.tenY === null ? "n/a" : `${snapshot.tenY.toFixed(2)}%`}`,
      `DXY: ${snapshot.dxy === null ? "n/a" : snapshot.dxy.toFixed(2)} (${snapshot.dxyTrend})`,
      `Fed Funds: ${snapshot.fedFunds === null ? "n/a" : `${snapshot.fedFunds.toFixed(2)}%`}`,
      `CPI: ${snapshot.cpi === null ? "n/a" : snapshot.cpi.toFixed(2)}`,
      "",
      "## META-ANALYST Commentary",
      commentary?.trim() || snapshot.summary,
      "",
    ].join("\n");

    await store.write(`_macro/${date}.md`, content);
    await appendVaultLog(store, {
      type: "macro",
      title: `Macro snapshot for ${date}`,
      details: `Regime ${snapshot.regime} · VIX ${macroValue(snapshot.vix)} · 10Y ${macroValue(snapshot.tenY)} · DXY ${macroValue(snapshot.dxy)} (${snapshot.dxyTrend})`,
    });
  } catch (err) {
    console.error("[obsidian] Failed to write macro snapshot:", err);
  }
}

export async function writeEventsSnapshot(
  date: string,
  snapshot: EventsSnapshot,
  store: VaultStore
): Promise<void> {
  try {
    const earningsLines =
      snapshot.earnings.length > 0
        ? snapshot.earnings.map((event) => {
            const epsEstimate =
              event.epsEstimate === null ? "n/a" : event.epsEstimate.toFixed(2);
            return `- [[${event.ticker}]] earnings (${event.hour ?? "unspecified"}, EPS est ${epsEstimate})`;
          })
        : ["- No earnings events for tracked holdings."];

    const macroLines =
      snapshot.macroEvents.length > 0
        ? snapshot.macroEvents.map((event) => `- ${event.title} (${event.type.toUpperCase()})`)
        : ["- No scheduled Fed/CPI/jobs events today."];

    const content = [
      "---",
      `date: "${date}"`,
      "type: events-snapshot",
      `earningsCount: ${snapshot.earnings.length}`,
      `macroEventCount: ${snapshot.macroEvents.length}`,
      "tags:",
      "  - events",
      "  - world-brain",
      "---",
      "",
      `# Events Snapshot - ${date}`,
      "",
      "## Earnings",
      ...earningsLines,
      "",
      "## Fed and Macro Calendar",
      ...macroLines,
      "",
    ].join("\n");

    await store.write(`_events/${date}.md`, content);
    await appendVaultLog(store, {
      type: "events",
      title: `Events snapshot for ${date}`,
      details: `${snapshot.earnings.length} earnings, ${snapshot.macroEvents.length} macro events.`,
    });
  } catch (err) {
    console.error("[obsidian] Failed to write events snapshot:", err);
  }
}