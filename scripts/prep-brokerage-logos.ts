/**
 * Prepares transparent brokerage logos for the dark account panel.
 *
 * SnapTrade's square logos are inconsistent: some are transparent PNGs, others
 * are JPGs with a solid white background baked into the pixels (e.g. E*Trade).
 * White can't be removed with CSS, so for any logo whose background is near-white
 * we chroma-key white → transparent with sharp and write a clean PNG to
 * public/brokerages/<normalized-slug>.png. The account panel prefers these local
 * copies (see logoFor() in BrokerageCard.tsx) and falls back to the remote URL.
 *
 * We only key logos with a near-white *background* (corner sampling). Logos that
 * are already transparent, or sit on a colored/dark background (e.g. PNC navy),
 * are skipped — chroma-keying a colored background eats the logo's edges. Use the
 * remote image as-is for those.
 *
 * Source: SnapTrade referenceData.listAllBrokerages() → square logo per brokerage.
 *
 * Usage:  npx tsx --env-file=.env.local scripts/prep-brokerage-logos.ts
 */
import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { hydrateSecrets } from "../lib/secrets";
import { getSnapTradeClient, isSnapTradeConfigured } from "../lib/snaptrade/client";

const OUT_DIR = path.join(process.cwd(), "public", "brokerages");
const WHITE = 238; // channels at/above this count as "white background"
const FEATHER = 210; // below this stays fully opaque; between → partial alpha

/** Same normalization BrokerageCard uses, so local files are actually found. */
function normalizeKey(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True if the image's four corners are all near-white. */
function hasWhiteBackground(data: Buffer, w: number, h: number, ch: number): boolean {
  const at = (x: number, y: number) => {
    const i = (y * w + x) * ch;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  return corners.every(([r, g, b]) => r >= WHITE && g >= WHITE && b >= WHITE);
}

type Result = "keyed" | "skipped-transparent-or-colored" | "no-logo" | "error";

async function keyLogo(slug: string, url: string): Promise<Result> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());

  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  if (!hasWhiteBackground(data, width, height, channels)) {
    return "skipped-transparent-or-colored";
  }

  // Flood-fill the white background inward from the four corners. Only the
  // *contiguous* white region connected to the border is keyed, so white marks
  // sitting inside a colored tile (e.g. moomoo's white bull on orange) survive
  // instead of being punched into transparent holes. Near-white boundary pixels
  // get partial alpha (feather) and stop propagation so edges don't look ragged.
  const minChan = (i: number) => Math.min(data[i], data[i + 1], data[i + 2]);
  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    stack.push(p);
  };
  push(0, 0); push(width - 1, 0); push(0, height - 1); push(width - 1, height - 1);
  while (stack.length) {
    const p = stack.pop()!;
    const i = p * channels;
    const minC = minChan(i);
    if (minC >= WHITE) {
      data[i + 3] = 0; // pure background — fully transparent, keep flooding
      const x = p % width, y = (p / width) | 0;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    } else if (minC >= FEATHER) {
      // Boundary pixel: soften but don't propagate (this is the logo's edge).
      data[i + 3] = Math.round(((WHITE - minC) / (WHITE - FEATHER)) * data[i + 3]);
    }
  }

  const out = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, `${normalizeKey(slug)}.png`), out);
  return "keyed";
}

interface BrokerageLike {
  slug?: string | null;
  name?: string | null;
  aws_s3_square_logo_url?: string | null;
  aws_s3_logo_url?: string | null;
}

async function main() {
  await hydrateSecrets();
  if (!isSnapTradeConfigured()) {
    console.error("SnapTrade not configured (SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY missing).");
    process.exit(1);
  }

  const client = getSnapTradeClient();
  const { data } = await client.referenceData.listAllBrokerages();
  const brokerages = (data ?? []) as BrokerageLike[];
  console.log(`Fetched ${brokerages.length} brokerages from SnapTrade.\n`);

  const counts: Record<Result, number> = {
    keyed: 0,
    "skipped-transparent-or-colored": 0,
    "no-logo": 0,
    error: 0,
  };
  const keyed: string[] = [];

  for (const b of brokerages) {
    const slug = b.slug ?? b.name ?? "";
    if (!slug) continue;
    const url = b.aws_s3_square_logo_url ?? b.aws_s3_logo_url ?? null;
    if (!url) {
      counts["no-logo"]++;
      console.log(`· ${slug}: no logo URL`);
      continue;
    }
    try {
      const r = await keyLogo(slug, url);
      counts[r]++;
      if (r === "keyed") {
        keyed.push(normalizeKey(slug));
        console.log(`✓ ${slug} → public/brokerages/${normalizeKey(slug)}.png`);
      } else {
        console.log(`· ${slug}: ${r}`);
      }
    } catch (err) {
      counts.error++;
      console.error(`✗ ${slug}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(
    `\nDone. keyed=${counts.keyed}  skipped=${counts["skipped-transparent-or-colored"]}  ` +
      `no-logo=${counts["no-logo"]}  errors=${counts.error}`,
  );
  if (keyed.length) console.log(`\nKeyed (white→transparent): ${keyed.join(", ")}`);
}

main();
