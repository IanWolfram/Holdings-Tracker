# Plan: State of the World

## Summary
A new `/world` tab in Pulse — a Three.js low-poly wireframe Earth that passively spins in space. Country borders glow green/red/yellow (BUY/SELL/HOLD) based on news sentiment linked to your holdings. Two types of markers appear on the globe: **HQ dots** (where companies are headquartered, scaled by position size) and **news-origin overlays** (countries that published relevant stories). Hovering a highlighted country shows a popup with the related stories. A separate **world-brain** Ollama agent continuously ingests news, infers sector connections, and writes structured Markdown notes to an Obsidian-compatible vault on disk.

## User Story
As a portfolio holder,
I want a 3D globe that shows me where geopolitical and sector news is affecting my stocks,
So that I can quickly understand the global context of my holdings without reading every article.

## Problem → Solution
Static news cards in Terminal tab → Interactive 3D globe at `/world` that makes geographic and sector-level connections visible at a glance.

## Metadata
- **Complexity**: XL
- **Source PRD**: N/A (free-form)
- **PRD Phase**: N/A
- **Estimated Files**: 18 new/modified files across 4 layers

---

## On the "One AI Brain" Decision

**Recommendation: Keep them separate — wire to the same Ollama instance.**

| Agent | Job | Speed requirement | Prompt style |
|---|---|---|---|
| `stock-analyzer` | BUY/SELL/HOLD per headline | ~3s per call | Short, focused |
| `world-brain` | Sector inference + Obsidian writing | ~30s per batch | Long, contextual |

Merging them means every BUY/SELL/HOLD call drags the full world-context prompt into Ollama — massive slowdown on the main dashboard. Instead, the world-brain runs in a **continuous background loop** (`/lib/world-brain/`) while the stock-analyzer stays lean and reactive. They share Ollama via an exported semaphore.

---

## UX Design

### Before
```
┌─────────────────────────────────────┐
│  TopBar nav: Terminal Holdings      │
│  Analyst  Alerts  ← no World tab   │
│  (No geographic view exists at all) │
└─────────────────────────────────────┘
```

### After
```
┌──────────────────────────────────────────────────────┐
│  Pulse  | Terminal  Holdings  Analyst  Alerts  World │
│                                                      │
│  ┌─── Full-screen dark space background ──────────┐  │
│  │   🌐 Spinning low-poly wireframe Earth         │  │
│  │   [USA glows RED] ← chip tariff news           │  │
│  │   [TWN glows GREEN] ← TSMC beat earnings       │  │
│  │   ● NVDA (large dot at USA coords)             │  │
│  │   ● TSMC (medium dot at TWN coords)            │  │
│  │   [Hover TWN] → popup card with 3 stories      │  │
│  └────────────────────────────────────────────────┘  │
│  [Relevance Slider: 40%] [Last updated: 7:00 PM]    │
└──────────────────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After |
|---|---|---|
| TopBar nav | `href="#"` placeholders | `/world` Next.js route |
| Globe view | Doesn't exist | Full-screen Three.js canvas |
| Country hover | N/A | Glassmorphic popup with stories |
| Country color | N/A | BUY=green, SELL=red, HOLD=slate pulse |
| Position markers | N/A | Dots at HQ lat/lon, sized by $ value |
| Brain output | N/A | Obsidian `.md` files in `world-vault/` |
| Relevance filter | N/A | Slider in bottom HUD bar |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `lib/classifier.ts` | all | Ollama call pattern + semaphore to share |
| P0 | `lib/finnhub.ts` | all | Finnhub fetch pattern to extend for profiles |
| P0 | `lib/news.ts` | all | Per-ticker caching pattern to replicate |
| P0 | `pages/api/news.ts` | all | API handler pattern to clone for `/api/world` |
| P0 | `app/globals.css` | all | Liquid Glass + color tokens to reuse |
| P1 | `components/TopBar.tsx` | all | Nav link pattern for new World tab |
| P1 | `types/news.types.ts` | all | `ClassifiedStory` type to extend |
| P2 | `components/DesktopDashboard.tsx` | all | Layout pattern |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Finnhub company profile | `GET /api/v1/stock/profile2?symbol=NVDA&token=KEY` | Returns `country`, `finnhubIndustry`, `gsector`, `gind` — all needed |
| GeoJSON country borders | Natural Earth / datahub.io | Use `countries.geojson` with `ISO_A2` property; fetch at runtime |
| Three.js low-poly sphere | Three.js docs | `new THREE.IcosahedronGeometry(radius, 2)` for low-poly look |
| Lat/Lon → 3D Cartesian | Math | `x=-r·sin(phi)·cos(theta)`, `y=r·cos(phi)`, `z=r·sin(phi)·sin(theta)` |
| GeoJSON coordinate order | RFC 7946 | Uses `[longitude, latitude]` — SWAP when calling `latLonToVector3` |
| Obsidian wikilinks | Obsidian docs | `[[Note Title]]` creates graph edges; YAML frontmatter for metadata |

---

## Patterns to Mirror

### NAMING_CONVENTION
```typescript
// SOURCE: lib/finnhub.ts:1-7
export interface NewsArticle {
  headline: string;
  summary: string;
  url: string;
  datetime: number; // unix timestamp
  source: "finnhub";
}
// New interfaces follow same: export interface, camelCase fields, typed source
```

### ERROR_HANDLING
```typescript
// SOURCE: lib/news.ts:37-61
const [finnhubArticles] = await Promise.all([
  process.env.FINNHUB_API_KEY
    ? fetchFinnhubNews(ticker).catch((err) => {
        console.error(`[news] Finnhub error for ${ticker}:`, err);
        return [];
      })
    : [],
]);
// Always .catch() per-source, return [] on fail, never throw from aggregators
```

### LOGGING_PATTERN
```typescript
// SOURCE: lib/classifier.ts:112-113
console.error(`[classifier] Ollama error ${res.status}`);
console.error(`[news] Finnhub error for ${ticker}:`, err);
// Prefix all logs with [module-name], template literals, lowercase names
```

### OLLAMA_CALL_PATTERN
```typescript
// SOURCE: lib/classifier.ts:70-122
let ollamaQueue: Promise<unknown> = Promise.resolve();
export function withOllamaSemaphore<T>(fn: () => Promise<T>): Promise<T> {
  const result: Promise<T> = ollamaQueue.then(() => fn(), () => fn());
  ollamaQueue = result.then(() => undefined, () => undefined);
  return result;
}
// ALL Ollama calls MUST use withOllamaSemaphore; 180s timeout
```

### CACHE_PATTERN
```typescript
// SOURCE: lib/news.ts:28-33
const cache = new Map<string, { data: ClassifiedStory[]; expiresAt: number }>();
export async function getNewsForTicker(ticker: string) {
  const cached = cache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  // ...fetch...
  cache.set(ticker, { data: classified, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
}
// Map-based cache, TTL from constants, check before fetching
```

### API_HANDLER_PATTERN
```typescript
// SOURCE: pages/api/news.ts:all
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const data = await getData();
    res.status(200).json(data);
  } catch (err) {
    console.error("[/api/route]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}
```

### DESIGN_SYSTEM
```css
/* SOURCE: app/globals.css:14-15 */
--color-positive: #00FF88;   /* BUY / green */
--color-negative: #FF4444;   /* SELL / red  */
/* .glass-material — use for tooltip popups */
/* All new UI must use these tokens. No ad-hoc colors. */
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `package.json` | UPDATE | Add `three`, `@types/three` |
| `types/geo.types.ts` | CREATE | `CompanyProfile`, `GeoStory`, `CountryState`, `WorldData` |
| `types/news.types.ts` | UPDATE | Add `relevanceScore?`, `originCountry?` to `ClassifiedStory` |
| `lib/world-brain/AGENT.md` | CREATE | World-brain agent identity |
| `lib/world-brain/sector-rules.md` | CREATE | Sector → ticker mapping rules |
| `lib/company-profile.ts` | CREATE | Finnhub `/stock/profile2` fetcher with 24h cache |
| `lib/country-coords.ts` | CREATE | Static country name → `{lat, lon, code}` map |
| `lib/world-brain/brain.ts` | CREATE | Ollama sector inference engine |
| `lib/world-brain/obsidian.ts` | CREATE | Writes `.md` notes to `world-vault/` |
| `lib/world-data.ts` | CREATE | `getWorldData()` aggregator with 15-min cache |
| `lib/constants.ts` | UPDATE | Add `WORLD_CACHE_TTL_MS`, `WORLD_VAULT_PATH` |
| `lib/classifier.ts` | UPDATE | Export `withOllamaSemaphore` |
| `pages/api/world.ts` | CREATE | `GET /api/world` |
| `public/countries.geojson` | CREATE | Bundled world GeoJSON with `ISO_A2` |
| `app/world/page.tsx` | CREATE | `/world` route (client component) |
| `components/world/GlobeCanvas.tsx` | CREATE | Three.js globe |
| `components/world/CountryTooltip.tsx` | CREATE | Hover popup |
| `components/world/WorldHUD.tsx` | CREATE | Bottom HUD with slider + legend |
| `components/TopBar.tsx` | UPDATE | Wire "World" tab to `/world` |
| `.env.example` | UPDATE | Add `WORLD_VAULT_PATH` |

## NOT Building
- Mobile version of the globe (desktop only)
- Real-time WebSocket feeds (polling, 15-min cadence)
- Cloud LLM (Ollama only)
- Global news beyond current holdings scope (designed for it, scoped to holdings now)
- `react-globe.gl` (pure Three.js as specified)
- 3D fill meshes for countries (border lines only — wireframe aesthetic)

---

## Step-by-Step Tasks

### Task 1: Install Three.js
- **ACTION**: Add Three.js to project
- **IMPLEMENT**: `npm install three @types/three`
- **GOTCHA**: Three.js is ESM — must only import in `"use client"` components. Never in API routes or server components.
- **VALIDATE**: `import * as THREE from 'three'` resolves; TypeScript compiles

### Task 2: Type Definitions
- **ACTION**: Create `types/geo.types.ts` and update `types/news.types.ts`
- **IMPLEMENT**:
```typescript
// types/geo.types.ts
export interface CompanyProfile {
  ticker: string;
  name: string;
  country: string;        // Finnhub full name e.g. "United States"
  countryCode: string;    // ISO alpha-2 e.g. "US"
  sector: string;         // e.g. "Technology"
  industry: string;       // e.g. "Semiconductors"
  lat: number;
  lon: number;
}

export interface GeoStory {
  ticker: string;
  headline: string;
  summary: string;
  url: string;
  datetime: number;
  verdict: "BUY" | "SELL" | "HOLD";
  confidence: number;
  reason?: string;
  source: string;
  originCountryCode?: string;   // ISO alpha-2 of news origin
  relevanceScore: number;       // 0-1 from world-brain
}

export interface CountryState {
  countryCode: string;
  netVerdict: "BUY" | "SELL" | "HOLD" | null;
  netScore: number;            // -1 to +1
  stories: GeoStory[];
  isHQCountry: boolean;
  hqTickers: string[];
  totalPositionValue: number;
}

export interface WorldData {
  countries: Record<string, CountryState>;
  profiles: Record<string, CompanyProfile>;
  fetchedAt: number;
}
```
```typescript
// types/news.types.ts — ADD optional fields to ClassifiedStory:
relevanceScore?: number;
originCountry?: string;
```
- **MIRROR**: `NAMING_CONVENTION` — PascalCase interfaces, camelCase fields
- **GOTCHA**: `country` from Finnhub is a full English name, NOT an ISO code. Must map via `country-coords.ts`.
- **VALIDATE**: No TypeScript errors; downstream files import cleanly

### Task 3: Bundle GeoJSON
- **ACTION**: Download `countries.geojson` to `public/`
- **IMPLEMENT**: Download from `https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson` and save to `public/countries.geojson`. Verify it has `features[*].properties.ISO_A2`.
- **GOTCHA**: Do NOT import via webpack — always `fetch('/countries.geojson')` at runtime client-side. File is ~25MB, not suitable for webpack bundling.
- **VALIDATE**: `public/countries.geojson` exists, parseable JSON, `features[0].properties.ISO_A2` exists

### Task 4: Country Coords Lookup
- **ACTION**: Create `lib/country-coords.ts`
- **IMPLEMENT**:
```typescript
export const COUNTRY_COORDS: Record<string, { lat: number; lon: number; code: string }> = {
  "United States": { lat: 37.09, lon: -95.71, code: "US" },
  "China": { lat: 35.86, lon: 104.19, code: "CN" },
  "Taiwan": { lat: 23.69, lon: 120.96, code: "TW" },
  "South Korea": { lat: 35.91, lon: 127.77, code: "KR" },
  "Japan": { lat: 36.20, lon: 138.25, code: "JP" },
  "Germany": { lat: 51.16, lon: 10.45, code: "DE" },
  "Netherlands": { lat: 52.13, lon: 5.29, code: "NL" },
  "France": { lat: 46.22, lon: 2.21, code: "FR" },
  "United Kingdom": { lat: 55.37, lon: -3.43, code: "GB" },
  "Israel": { lat: 31.04, lon: 34.85, code: "IL" },
  "Canada": { lat: 56.13, lon: -106.34, code: "CA" },
  "Australia": { lat: -25.27, lon: 133.77, code: "AU" },
  "India": { lat: 20.59, lon: 78.96, code: "IN" },
  "Switzerland": { lat: 46.81, lon: 8.22, code: "CH" },
  "Sweden": { lat: 60.12, lon: 18.64, code: "SE" },
};
export function lookupCountry(name: string) { return COUNTRY_COORDS[name] ?? null; }
```
- **GOTCHA**: Finnhub returns "United States" not "USA" or "US". Match the exact string. Unknown countries return `null` and ticker is skipped — no crash.
- **VALIDATE**: `lookupCountry("United States")` returns `{ lat: 37.09, lon: -95.71, code: "US" }`

### Task 5: Finnhub Company Profile Fetcher
- **ACTION**: Create `lib/company-profile.ts`
- **IMPLEMENT**: Fetch `GET /api/v1/stock/profile2?symbol=${ticker}&token=${key}`. Extract `country`, `finnhubIndustry`, `gsector`, `gind`. Map country name to coords via `lookupCountry()`. 24h in-memory cache (profile data barely changes).
- **MIRROR**: `CACHE_PATTERN`, `ERROR_HANDLING`, `LOGGING_PATTERN` — `console.error("[company-profile] ...")`
- **GOTCHA**: Finnhub free tier: 60 req/min. 24h cache ensures at most one call per ticker per process restart. Return `null` gracefully on rate limit or unknown country.
- **VALIDATE**: Returns `CompanyProfile` with `countryCode: "US"` for NVDA ticker

### Task 6: World-Brain Agent Files
- **ACTION**: Create `lib/world-brain/AGENT.md` and `lib/world-brain/sector-rules.md`
- **IMPLEMENT**:
  - `AGENT.md`: Identity as macro-financial analyst. JSON output: `{sector_tags, affected_tickers, origin_country_code, relevance_score, geo_summary}`
  - `sector-rules.md`: Maps keywords → sectors → relevance tiers (direct mention = 0.95+, same sector/country = 0.7-0.9, adjacent = 0.3-0.5)
- **MIRROR**: `agents/stock-analyzer/AGENT.md` file structure and JSON-only output rule
- **GOTCHA**: Output must be parseable JSON — same constraint as stock-analyzer. Instruct model firmly.
- **VALIDATE**: Files exist and are readable

### Task 7: Export Semaphore from classifier.ts
- **ACTION**: Export `withOllamaSemaphore` from `lib/classifier.ts`
- **IMPLEMENT**: Change `function withOllamaSemaphore` → `export function withOllamaSemaphore`
- **GOTCHA**: Only export the function, not the `ollamaQueue` variable (keeps queue private).
- **VALIDATE**: `import { withOllamaSemaphore } from "@/lib/classifier"` resolves without error

### Task 8: World-Brain Inference Engine
- **ACTION**: Create `lib/world-brain/brain.ts`
- **IMPLEMENT**: Loads AGENT.md + sector-rules.md once. Calls Ollama via imported `withOllamaSemaphore`. Parses JSON response into `BrainAnalysis`. Falls back to `{relevanceScore: 0.5, affectedTickers: [], ...}` when Ollama unreachable. Filters `affectedTickers` to only include actual holdings.
- **MIRROR**: `OLLAMA_CALL_PATTERN` exactly — same fetch pattern, same 180s timeout, same JSON parsing regex `/\{[\s\S]*\}/`
- **IMPORTS**: `withOllamaSemaphore` from `"../classifier"` (shared queue — critical)
- **GOTCHA**: MUST import shared semaphore. Two queues = race conditions and Ollama crashes.
- **VALIDATE**: Returns `BrainAnalysis` with valid structure on both success and Ollama-down

### Task 9: Obsidian Note Writer
- **ACTION**: Create `lib/world-brain/obsidian.ts`
- **IMPLEMENT**: Two functions — `writeStoryNote(story, vaultPath)` writes individual story as `.md` with YAML frontmatter + `[[ticker]]` wikilinks. `writeDailySummary(date, stories, vaultPath)` writes a daily aggregate. Both use `fs.mkdirSync` + `fs.writeFileSync`. Paths: `world-vault/news/YYYY-MM-DD-slug.md`, `world-vault/daily/YYYY-MM-DD.md`.
- **GOTCHA**: This is Node.js `fs` — ONLY server-side. NEVER import in `"use client"` components or `app/` pages. Write guard: `if (!vaultPath) return;`
- **VALIDATE**: Creates valid `.md` with YAML frontmatter headers and `[[NVDA]]` wikilink style

### Task 10: Update Constants
- **ACTION**: Update `lib/constants.ts`
- **IMPLEMENT**: Add `export const WORLD_CACHE_TTL_MS = 15 * 60 * 1000;` and `export const WORLD_VAULT_PATH = process.env.WORLD_VAULT_PATH ?? null;`
- **VALIDATE**: Importable from other lib files

### Task 11: World Data Aggregator
- **ACTION**: Create `lib/world-data.ts`
- **IMPLEMENT**: `getWorldData(positions)` function with 15-min cache. Steps:
  1. Fetch all `CompanyProfile`s for all tickers (parallel `Promise.all`)
  2. For each ticker, get news via existing `getNewsForTicker()`
  3. For each story, call `analyzeStory()` from world-brain (SEQUENTIAL — respects semaphore)
  4. Write story + daily notes to Obsidian vault (if `WORLD_VAULT_PATH` is set)
  5. Build `CountryState` records for both HQ countries and news-origin countries
  6. Compute `netVerdict` per country: score > 0.15 → BUY, < -0.15 → SELL, else HOLD
- **MIRROR**: `CACHE_PATTERN` — module-level cache Map, check before computing
- **GOTCHA**: Ollama calls are sequential per the semaphore — `getWorldData` on first call for 20 stocks with 5 stories each = 100 Ollama calls = potentially 5 minutes. This is expected and the 15-min cache makes it invisible after first run.
- **VALIDATE**: Returns `WorldData` with `countries` and `profiles` populated

### Task 12: `/api/world` Endpoint
- **ACTION**: Create `pages/api/world.ts`
- **IMPLEMENT**: `GET /api/world` — gets positions via `getPositionsSafe()`, passes to `getWorldData()`, returns JSON.
- **MIRROR**: `API_HANDLER_PATTERN` exactly from `pages/api/news.ts`
- **VALIDATE**: `curl http://localhost:3000/api/world` returns JSON

### Task 13: GlobeCanvas (Three.js)
- **ACTION**: Create `components/world/GlobeCanvas.tsx`
- **IMPLEMENT**: Full Three.js scene in `useEffect`. Key elements:
  - **Base sphere**: `IcosahedronGeometry(1, 3)` + dark `MeshBasicMaterial({ color: 0x080808 })`
  - **Wireframe overlay**: `WireframeGeometry` + `LineBasicMaterial({ color: 0x1a221a, opacity: 0.25, transparent: true })`
  - **Country borders**: Parse GeoJSON in `useEffect` after fetch. For each polygon ring, convert `[lon, lat]` coords to 3D via `latLonToVector3`. Create `THREE.Line` per ring colored by `CountryState.netVerdict`. Store `ISO_A2` in `.userData.code`.
  - **HQ markers**: `SphereGeometry(0.008, 8, 8)` at HQ lat/lon, radius 1.015. Scale by `sqrt(marketValue/maxValue) * 0.03`. White, emissive.
  - **Starfield**: 2000 random `THREE.Points` at radius 5
  - **Rotation**: `globe.rotation.y += 0.0008` each frame
  - **Raycasting**: `THREE.Raycaster` on `mousemove`, check nearest country line, emit `onCountryHover(code)`
  - **Cleanup**: `renderer.dispose()`, `scene.clear()` on unmount

```typescript
// Coordinate conversion
function latLonToVector3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}
```
- **MIRROR**: `DESIGN_SYSTEM` — `#00FF88` for BUY borders, `#FF4444` for SELL, `#64748b` for HOLD, `#1e2023` for default
- **GOTCHA 1**: `"use client"` required at top of file.
- **GOTCHA 2**: GeoJSON coords are `[longitude, latitude]` — pass as `latLonToVector3(coord[1], coord[0], r)`.
- **GOTCHA 3**: `relevanceThreshold` prop: only color country borders of countries with `max(story.relevanceScore) >= threshold`.
- **GOTCHA 4**: Dispose renderer on unmount — return cleanup from `useEffect`.
- **VALIDATE**: Globe spins; at least one country border glows; HQ dot visible

### Task 14: CountryTooltip
- **ACTION**: Create `components/world/CountryTooltip.tsx`
- **IMPLEMENT**: Glass card positioned at `{mouseX, mouseY}` (clamped to viewport). Shows:
  - Country name + iso flag emoji (derive via lookup table)
  - Net verdict badge (reuse `VerdictBadge`)
  - Up to 5 `GeoStory` items: ticker badge, headline, confidence bar
  - "HQ: NVDA" if `isHQCountry`; `$N position value`
- **MIRROR**: `glass-material` CSS class + `#1e2023` background + Space Grotesk/JetBrains Mono fonts
- **GOTCHA**: Clamp tooltip position: `Math.min(mouseX, window.innerWidth - tooltipWidth - 16)` etc.
- **VALIDATE**: Tooltip appears on hover, disappears on leave, never clips viewport

### Task 15: WorldHUD
- **ACTION**: Create `components/world/WorldHUD.tsx`
- **IMPLEMENT**: Fixed bottom bar with:
  - Relevance slider: `<input type="range" min={0} max={100}>`
  - Last updated timestamp
  - Color legend: `● BUY  ● SELL  ● HOLD`
  - Story count: "N stories across M countries"
- **MIRROR**: `glass-material` for bar background; `bg-[#1e2023]` surface
- **GOTCHA**: Slider `onChange` → update parent state → GlobeCanvas re-renders. No API call on slider move.
- **VALIDATE**: Slider moves → globe updates visible country glows

### Task 16: World Page Route
- **ACTION**: Create `app/world/page.tsx`
- **IMPLEMENT**: Client component. Fetches `/api/world` on mount and every 15 min. State: `worldData`, `loading`, `relevanceThreshold`, `hoveredCountry`, `mousePos`. Imports `GlobeCanvas` via `dynamic(() => import(...), { ssr: false })`. Shows loading spinner with "Building world intelligence… takes 2-3 min" message. Composes `GlobeCanvas` + `CountryTooltip` + `WorldHUD` + `TopBar`.
- **MIRROR**: `useCallback`/`useEffect`/`useRef`/polling pattern from `app/page.tsx`
- **GOTCHA**: `next/dynamic` with `{ ssr: false }` is MANDATORY for Three.js. Without it, Next.js SSR crashes.
- **VALIDATE**: `/world` loads; spinner shows; globe renders after data arrives

### Task 17: TopBar Navigation Update
- **ACTION**: Update `components/TopBar.tsx`
- **IMPLEMENT**: Add `usePathname()` from `next/navigation`. Change `href` values: `"/"` for Terminal, `"/world"` for World. Add active state: `pathname === "/world"` → `text-white border-b-2 border-white`. Add World tab using `public` Material Symbol icon.
- **MIRROR**: Existing nav item class pattern: `px-4 h-full flex items-center gap-2 transition-all border-b-2`
- **GOTCHA**: `usePathname` requires `"use client"` — already present.
- **VALIDATE**: `/world` tab shows active (bright white), Terminal tab shows active from `/`

### Task 18: .env.example Update
- **ACTION**: Add to `.env.example`:
```
# World Brain Obsidian vault (relative to project or absolute path)
WORLD_VAULT_PATH=./world-vault
```
- **VALIDATE**: File has new variable

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `lookupCountry("United States")` | string | `{lat, lon, code: "US"}` | No |
| `lookupCountry("Andorra")` | unknown | `null` (no crash) | Yes |
| `latLonToVector3(0, 0, 1)` | equator | approx `{x:0, y:0, z:1}` | No |
| `getWorldData([])` | empty positions | `{countries:{}, profiles:{}}` | Yes |
| Country net score: all BUY | 3 BUY stories | `netVerdict: "BUY"` | No |
| Country net score: mixed | 2 BUY 3 SELL | `netVerdict: "SELL"` | No |
| Country net score: balanced | equal | `netVerdict: "HOLD"` | Yes |
| `writeStoryNote` | valid GeoStory | `.md` file with YAML | No |

### Edge Cases Checklist
- [ ] Finnhub unknown country → `lookupCountry` null → ticker gracefully skipped
- [ ] Ollama unreachable → fallback `BrainAnalysis` with `relevanceScore: 0.5`
- [ ] No holdings → globe shows blank sphere, no markers, no crash
- [ ] GeoJSON fetch fails → globe renders blank sphere, no country lines
- [ ] `WORLD_VAULT_PATH` not set → Obsidian writes silently skipped
- [ ] Globe resize → `renderer.setSize` via `ResizeObserver`
- [ ] Navigate away from `/world` → Three.js renderer disposed, no memory leak

---

## Validation Commands

### TypeScript
```bash
cd /Users/ianwolf/Holdings-Tracker && npx tsc --noEmit
```
EXPECT: Zero type errors

### Build
```bash
npm run build
```
EXPECT: No errors

### API Test
```bash
curl http://localhost:3000/api/world | jq '.countries | keys'
```
EXPECT: Array of ISO country codes (e.g. `["US", "TW", "KR"]`)

### GeoJSON Asset
```bash
curl http://localhost:3000/countries.geojson | jq '.features | length'
```
EXPECT: ~250

### Obsidian Vault
```bash
ls ./world-vault/news/ | head -10
```
EXPECT: `.md` files with today's date prefix

### Manual Validation
- [ ] Globe spins passively (~1 rotation per 2 min)
- [ ] At least one country border glows green or red with mock data
- [ ] HQ dot visible at approximate USA coordinates for US holdings
- [ ] Hovering a glowing country shows glassmorphic popup with stories
- [ ] Popup disappears on mouse leave
- [ ] Relevance slider at 0% → all countries with any story shown
- [ ] Relevance slider at 90% → only highest-confidence stories shown
- [ ] "World" tab in TopBar active when on `/world` route
- [ ] Loading spinner with friendly message shows during first load
- [ ] Navigate Terminal → World → Terminal → no Three.js memory leak (DevTools)

---

## Acceptance Criteria
- [ ] All 18 tasks completed
- [ ] `/world` route accessible at `localhost:3000/world`
- [ ] Globe renders and spins in dark space background
- [ ] Country borders glow BUY/SELL/HOLD colors based on news
- [ ] HQ markers scaled by position $ value
- [ ] Hover tooltips show relevant stories with verdicts
- [ ] Relevance slider filters globe display
- [ ] World-brain writes `.md` files to `world-vault/`
- [ ] TypeScript zero errors
- [ ] No memory leaks on navigation

## Completion Checklist
- [ ] Code follows cache, error, logging patterns
- [ ] Ollama calls share semaphore from `classifier.ts`
- [ ] Three.js disposed on unmount
- [ ] No `"use client"` on server files (`obsidian.ts`, `world-data.ts`, `brain.ts`)
- [ ] `GlobeCanvas` imported with `dynamic({ ssr: false })`
- [ ] GeoJSON fetched at runtime, not bundled
- [ ] All colors use design tokens: `#00FF88`, `#FF4444`, `#1e2023`
- [ ] `.env.example` updated

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| First `/api/world` load: 5+ min | High | High | Loading spinner with "2-3 min" message; 15-min cache hides it after |
| Ollama semaphore contention | Medium | Medium | `/world` is separate route; unlikely both polling simultaneously |
| Three.js GeoJSON parse slow | Medium | Low | Parse once on mount, store line objects in ref |
| Finnhub rate limit | Low | Medium | 24h profile cache; graceful null on limit |
| Country name mismatch | Medium | Medium | Graceful null; log mismatches for expansion |
| Three.js memory leak | Low | High | `renderer.dispose()` + `scene.clear()` in `useEffect` cleanup |

## Notes

**On Obsidian**: World-brain creates a vault at `world-vault/` (env-configurable). To use with Obsidian, open that folder as your vault. `[[wikilinks]]` and YAML frontmatter are Obsidian-native. You can also point the MCP filesystem server at `./world-vault` for Claude Code graph traversal.

**On two-agent architecture**: Stock-analyzer remains unchanged for Terminal tab. World-brain only runs when `/api/world` is polled. They share Ollama via the exported semaphore for natural serialization.

**On globe aesthetic**: Dark icosahedron base + subtle green-tinted wireframe overlay creates the space/low-poly look. Country borders are `LINE` objects on top — not filled meshes. This gives the "wireframe outline" feel you described.
