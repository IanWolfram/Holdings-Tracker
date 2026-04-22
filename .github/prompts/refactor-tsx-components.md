# TSX Component Refactor — Holdings Tracker (Pulse)

## Mission

You are a TypeScript/React refactoring agent operating on the **Holdings Tracker** codebase (`/Users/ianwolf/Holdings-Tracker`). Your job is to restructure every `.tsx` file so the codebase is clean, maintainable, and follows DRY + SOLID principles. You will work file by file using subagents, validate nothing is broken after each change, and commit when done.

---

## Context

**Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Framer Motion, SWR, TypeScript  
**Key directories:**
- `components/` — shared UI components
- `app/` — Next.js App Router pages (`page.tsx`, `layout.tsx`)
- `pages/api/` — API routes (Pages Router, do NOT touch)
- `lib/` — non-UI utilities and services (do NOT touch unless a component is importing logic it shouldn't own)
- `types/` — shared TypeScript types

**Files known to be large / messy (prioritize these):**

| File | Lines | Known issues |
|------|-------|--------------|
| `app/world/page.tsx` | 537 | Inline SVG components, massive `SECTOR_ICONS` map, all state in one component |
| `components/PositionCard.tsx` | 396 | Multiple inline sub-components, mixed concerns |
| `components/TopBar.tsx` | 344 | Congress polling logic, market status logic, and UI all in one file |
| `components/NewsCard.tsx` | 339 | Deep-analysis flow, animation logic, and rendering interleaved |
| `app/hot/page.tsx` | 324 | `ChangeBar`, `TickerRow` defined inline, polling logic mixed with render |
| `app/terminal/page.tsx` | 208 | Mixed UI and data-fetching concerns |
| `components/AgentTrigger.tsx` | 111 | Likely fine, verify |

---

## Rules

### File structure (enforce in every `.tsx` you touch)

Every `.tsx` file must follow this exact top-to-bottom order — no exceptions:

```
1. "use client" directive (if needed)
2. React and third-party imports
3. Local imports (components, lib, types)
4. Constants (CAPS_SNAKE_CASE)
5. TypeScript interfaces and types (local to this file only)
6. Pure helper functions (no hooks, no JSX)
7. Custom hooks (useXxx — if the hook is >20 lines or reused, extract to hooks/)
8. Sub-components (if they are only used in this file AND are <40 lines)
9. Default export component — return() only calls other components and minimal layout JSX
```

### Extraction rules

**Extract to a new file when:**
- An inline component exceeds 40 lines or contains its own state
- A constant block exceeds 30 lines (e.g., `SECTOR_ICONS`, `SOURCE_PRIORITY`)
- A data-fetching or polling pattern is reused across files → extract to `hooks/`
- A pure utility function is used in more than one component → move to `lib/utils/`

**Do NOT extract when:**
- The helper is a one-liner used only once in the same file
- Breaking it out would require passing more than 4 props (a sign the abstraction is wrong)

### Naming and folder conventions

```
components/
  <Domain>/                  # group by feature domain, not component type
    <ComponentName>.tsx
    <ComponentName>.types.ts  # only if types are shared with siblings
hooks/
  use<FeatureName>.ts        # one hook per file
components/icons/            # SVG icon components (already exists — add here)
```

Domains to consider splitting into:
- `components/news/` — `NewsCard`, `NewsCollapsible`, `PendingNewsCard`
- `components/positions/` — `PositionCard`, `SentimentBar`, `VerdictBadge`, `EmptyState`
- `components/world/` — already exists, may need internal extraction
- `components/layout/` — `TopBar`, `DesktopDashboard`

### DRY

- If the same prop shape is defined twice, pull it into `types/`
- If the same color map appears twice (e.g., `VERDICT_COLOR`), define it once in `lib/utils/` and import it
- If two components render the same source badge logic, it belongs in a shared `<SourceBadge>` component

### SOLID

- **Single Responsibility:** One component, one job. A card that fetches its own data AND animates AND classifies news violates SRP. The fetch belongs in a hook, the classification belongs in a util.
- **Open/Closed:** Prefer `variant` props and lookup maps over `if/else` chains in JSX. `VERDICT_COLOR[verdict]` is better than `verdict === "BUY" ? "#00FF88" : verdict === "SELL" ? ...`.
- **Liskov / Interface Segregation:** Don't pass giant prop objects if the component only uses 2 of 8 fields. Break prop interfaces at the seam.
- **Dependency Inversion:** Components should not import `lib/` services directly. They should receive data or callbacks as props, or use a custom hook that wraps the service.

---

## Execution Plan

Use **one subagent per file or logical group**. Run them sequentially (not in parallel) so file moves don't conflict.

### Phase 1 — Audit (read-only, no writes)

For each file in the priority list above, read the file and produce a short audit:
- Lines of code
- Number of components defined in the file
- Constants that should be extracted
- Hooks that should be extracted
- Violations of the structure order rule

### Phase 2 — Refactor (write)

Work through files in this order. For each:

1. **Read** the full file
2. **Plan** what gets extracted (write your plan as a comment before doing anything)
3. **Create** any new files for extracted pieces first
4. **Rewrite** the source file referencing the new extractions
5. **Verify** TypeScript still compiles: `cd /Users/ianwolf/Holdings-Tracker && npx tsc --noEmit`
6. If compile fails, fix before moving to the next file

**Order:**
1. `app/world/page.tsx` — extract `SECTOR_ICONS` → `components/icons/SectorIcons.tsx`, extract `NewspaperIcon`, `BriefcaseIcon`, `ChevronDownIcon`, `ChevronRightIcon` → `components/icons/`, extract world-page polling into `hooks/useWorldData.ts`
2. `components/PositionCard.tsx` — extract `SourceBadge`, `CongressHeader` to their own files; extract the sort/filter logic into `lib/utils/stories.ts`; keep PositionCard thin
3. `components/TopBar.tsx` — extract congress-polling into `hooks/useCongressTrades.ts`; extract market-status logic into `hooks/useMarketStatus.ts`; keep TopBar as layout only
4. `components/NewsCard.tsx` — extract deep-analysis fetch into `hooks/useDeepAnalysis.ts`; extract the SVG border animation helpers into `lib/utils/newsCardAnimations.ts`
5. `app/hot/page.tsx` — extract `ChangeBar` → `components/ui/ChangeBar.tsx`; extract `TickerRow` → `components/positions/TickerRow.tsx`; extract polling into `hooks/useHotTickers.ts`
6. `app/terminal/page.tsx` — audit and apply the same pattern
7. All remaining `components/*.tsx` files — apply structure order rule, extract anything that violates the 40-line / reuse rules

### Phase 3 — Cleanup

- Run `npx tsc --noEmit` one final time — zero errors required
- Run `npm run lint` — zero new lint errors
- Delete any files that are now empty or redundant
- Update barrel exports if any `index.ts` files exist

---

## Constraints

- **Do not change runtime behavior.** This is a structural refactor only. No logic changes, no new features.
- **Do not touch `pages/api/`** — API routes are out of scope.
- **Do not touch `lib/`** files unless you are moving logic OUT of a component INTO lib.
- **Preserve all existing prop names and component names** — renaming breaks imports in other files. Only rename if you are updating all call sites in the same commit.
- **No new comments** unless the code is genuinely non-obvious. Do not add docstrings.
- **Minimal diff philosophy:** If a file already follows the rules, leave it alone.

---

## Definition of Done

- [ ] Every `.tsx` file follows the import → constants → types → helpers → hooks → sub-components → default export order
- [ ] No `.tsx` file exceeds 200 lines (pages may go up to 300 if the extra lines are purely JSX layout)
- [ ] No inline component definition exceeds 40 lines
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npm run lint` passes with 0 new errors
- [ ] The dev server starts cleanly: `npm run dev`
- [ ] No runtime behavior has changed
