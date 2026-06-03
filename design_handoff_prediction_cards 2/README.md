# Handoff: Prediction Cards (Position Card → Predictions view)

## Overview
This is the redesigned **prediction list** that appears inside a stock **Position Card**. When the user taps the "Predictions" strip on a position card, this list replaces the news cards in the same panel. It shows a position's AI/model price predictions, split into **Pending** (in-flight) and **Resolved** (completed) groups.

The core design goal: make each row read as *forecast vs. reality* at a glance, with the predicted move on the left, what actually happened (or is happening) on the right, and a verdict at the end. Pending rows are "unfinished" versions of resolved rows — identical layout, but the right side shows the live move so far instead of a final outcome.

## About the Design Files
The file in this bundle (`Prediction Cards.html`) is a **design reference created in HTML** — a working prototype that demonstrates the intended look, layout, and behavior. It is **not production code to copy directly**.

The task is to **recreate this design in the target codebase's existing environment** (React, React Native, SwiftUI, Vue, etc.), using that codebase's established component patterns, styling system, and data layer. If no front-end environment exists yet, choose the most appropriate framework for the project and implement it there. The sample data in the HTML (`PREDICTIONS` array, `CURRENT_PRICE`) is illustrative — wire the real component to your prediction data model.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, and interactions are final. Recreate the UI to match these values using your codebase's libraries. The exact tokens are listed under **Design Tokens** below.

---

## Screens / Views

### View: Predictions panel (inside Position Card)
- **Purpose:** Let the user review every prediction made for this position, see how pending calls are tracking live, and review the accuracy of resolved calls.
- **Container:** Replaces the news-card area inside the existing Position Card. The card itself is `420px` wide in the mock (it should be fluid/full-width of the position card in production). The panel scrolls vertically with `max-height: 372px`.
- **Layout (top to bottom):**
  1. **Card header** — ticker icon (40×40), symbol, company name, price-per-share, and a sparkline chart on the right. *(This is the existing position-card header — not part of this redesign, shown only for context.)*
  2. **Predictions strip** — a full-width toggle button: label "Predictions" + score (`2/8 correct`, the bold number tinted green) on the left, a chevron on the right that rotates when expanded. Clicking it expands/collapses the panel below.
  3. **Predictions panel** — scrollable. Contains a **Pending** section then a **Resolved** section.

### Section header (Pending / Resolved)
- Sticky to the top of the scroll panel while its rows are in view.
- Left: section label (`PENDING` / `RESOLVED`) in mono, uppercase, bold, with letter-spacing `0.2em`, color `#555a62`, font-size `9.5px`. Followed by a count pill (the number of rows).
- A thin hairline rule (`1px`, `rgba(255,255,255,0.06)`) fills the remaining width.
- **Resolved header only:** a **filter button** is pinned to the right (see Interactions).

### Row: Pending prediction
A pending row is the "in-progress" version of a resolved row. Left rail is slate.
- **Left status rail:** `2px` wide, full-row-height, color slate `#94a3b8` at `opacity: 0.18`.
- **Comparison group** (a horizontal flex row, `align-items: center`, `gap: 12px`):
  - **Predicted cell** (column): label `PREDICTED` (mono, 8.5px, uppercase, `#555a62`), value below it. Value is the signed target move in mono `15px`/`600`:
    - UP → `+X.X%` colored green `#00ff88`
    - DOWN → `−X.X%` colored red `#ff4444`
    - FLAT → `±X.X%` colored slate `#94a3b8`
  - **Bridge** (column, centered): a small horizon label on top (`1d`, `7d`, `30d` — mono 8.5px/600, `#555a62`) and a **right-pointing arrow** below it. **The arrow length scales with the horizon** (longer prediction = longer arrow). Color `#3a3e44`.
  - **Now cell** (column): label `NOW` (centered over its value), value below = the **live move so far**, computed as `(CURRENT_PRICE − run_price) / run_price * 100`, formatted signed, green if ≥0 / red if <0.
  - **Verdict pill** (pushed to far right with `margin-left: auto`): pill showing a **radial time-remaining donut** + `Xd left`. Donut = fraction `daysLeft / horizon` drawn as an arc (it depletes as the prediction nears resolution). Pill color `#8a8f96`, background `rgba(148,163,184,0.10)`, ring color slate.
- **Meta line:** one quiet mono line (`10.5px`, `#8a8f96`): `{conf}% conf · {run date} · ${run price}`. *(Horizon is intentionally omitted here for pending+resolved because it already appears above the arrow.)* Dot separators are `#3a3e44`.
- **Reasoning:** one-line clamped body text (`11.5px`, `#555a62`); clicking it toggles full expansion.

### Row: Resolved prediction
Identical structure to a pending row, but **the entire row is tinted with its outcome color** and the right side shows the final result.
- **Outcome tint** (whole row background + left rail):
  - CORRECT → bg `rgba(0,255,136,0.055)`, rail `#00ff88` @ `opacity 0.55`
  - PARTIAL → bg `rgba(230,169,76,0.06)`, rail `#e6a94c` @ `opacity 0.55`
  - INCORRECT → bg `rgba(255,68,68,0.055)`, rail `#ff4444` @ `opacity 0.5`
- **Predicted cell:** same as pending.
- **Bridge:** same horizon label + horizon-scaled arrow.
- **Actual cell:** label `ACTUAL` (centered over value), value = the realized move `signed(actual%)`, green if ≥0 / red if <0.
- **Verdict pill** (far right): icon + outcome word.
  - CORRECT → check icon, green text, bg `rgba(0,255,136,0.12)`
  - PARTIAL → minus/dash icon, amber text, bg `rgba(230,169,76,0.14)`
  - INCORRECT → ✕ icon, red text, bg `rgba(255,68,68,0.13)`
- **Meta line + reasoning:** same as pending.

---

## Interactions & Behavior
- **Predictions strip toggle:** clicking the strip toggles `aria-expanded` and shows/hides the panel. Chevron rotates 180° (`transform 0.18s ease`).
- **Reasoning expand:** clicking a row's reasoning text toggles between 1-line clamp and full text. Color brightens slightly when open.
- **Resolved filter button** (right of the Resolved header): opens a dropdown menu with two single-select groups:
  - **Outcome:** All / Correct / Partial / Incorrect (each with a colored swatch).
  - **Sort by date:** Newest first / Oldest first.
  - Behavior: button label reflects active state; a small green dot appears when an outcome filter is active; the Resolved count pill switches to `visible/total` (e.g. `2/5`) when filtered. Menu closes on outside-click, Escape, or re-toggle. The menu uses fixed positioning so the scroll panel's overflow can't clip it; it repositions on panel scroll and window resize.
- **Empty state:** if a filter yields no rows, show `No {outcome} predictions` centered in mono.
- **No flashy animations** — only the chevron rotation, color transitions, and the static radial ring. Keep it calm.

## State Management
- `expanded` (bool) — is the predictions panel open.
- `filter.outcome` — one of `all | CORRECT | PARTIAL | INCORRECT`.
- `filter.sort` — `newest | oldest`.
- Per-row `reasoningOpen` (bool).
- Derived: resolved list filtered + sorted by run date; pending list always shown above.
- **Data fetching:** component receives the position's predictions array + the current price. Live "Now" move is derived from `currentPrice` vs each prediction's `run price`.

### Data model (per prediction)
```
{
  dir:      'UP' | 'DOWN' | 'FLAT',   // predicted direction
  mag:      number,                    // predicted magnitude, % (e.g. 8.0)
  conf:     number,                    // 0..1 confidence
  horizon:  number,                    // prediction window in days
  run:      string,                    // date prediction was made (e.g. 'May 14')
  price:    number,                    // price at run time (used for the live move)
  status:   'pending' | 'resolved',
  // pending only:
  daysLeft: number,                    // days remaining (for ring + 'Xd left')
  // resolved only:
  outcome:  'CORRECT' | 'PARTIAL' | 'INCORRECT',
  actual:   number,                    // realized move, % signed
  why:      string                     // reasoning text
}
```

### Key derivations
- **Predicted display:** UP→`+mag%`, DOWN→`−mag%`, FLAT→`±mag%`.
- **Live "Now" move (pending):** `((currentPrice - price) / price) * 100`, formatted signed.
- **Arrow width (px):** `round(22 + ((clamp(horizon,1,30) - 1) / 29) * 40)` → 1d = 22px, 30d = 62px.
- **Time ring fraction:** `clamp(daysLeft / horizon, 0, 1)`, drawn as a stroke-dasharray arc on a `r=5` circle, rotated −90° to start at top.

---

## Design Tokens

### Colors
| Token | Value | Use |
|---|---|---|
| `--bg` | `#080809` | App background |
| `--card` | `#121214` | Card surface |
| `--card-2` | `#18181c` | Dropdown menu surface |
| `--panel` | `#0d0f0e` | Predictions panel background |
| `--rule` | `rgba(255,255,255,0.06)` | Hairline separators |
| `--rule-2` | `rgba(255,255,255,0.10)` | Borders, button outlines |
| `--ink` | `#e8e8ea` | Primary text |
| `--ink-dim` | `#8a8f96` | Secondary text / meta |
| `--ink-dimmer` | `#555a62` | Labels, reasoning |
| `--ink-faint` | `#3a3e44` | Separators, arrow color |
| `--positive` | `#00ff88` | Up / correct (green) |
| `--positive-dim` | `#00cc6e` | Green accents |
| `--negative` | `#ff4444` | Down / incorrect (red) |
| `--amber` | `#e6a94c` | Partial (amber) |
| `--slate` | `#94a3b8` | Flat / pending |

Outcome row tints: CORRECT `rgba(0,255,136,0.055)`, PARTIAL `rgba(230,169,76,0.06)`, INCORRECT `rgba(255,68,68,0.055)`.
Verdict pill backgrounds: CORRECT `rgba(0,255,136,0.12)`, PARTIAL `rgba(230,169,76,0.14)`, INCORRECT `rgba(255,68,68,0.13)`, PENDING `rgba(148,163,184,0.10)`.

### Typography
- **Headline / ticker symbol:** "Space Grotesk", weights 600–700.
- **Body / reasoning:** "Inter", weights 300–600.
- **Data / numbers / labels:** "JetBrains Mono", weights 400–700.
- Sizes: ticker symbol `20px`; predicted/actual/now value `15px/600`; verdict pill `10px/700`, letter-spacing `0.06em`; cell labels `8.5px` uppercase, letter-spacing `0.14em`; meta line `10.5px`; reasoning `11.5px`, line-height `1.5`; section label `9.5px`, letter-spacing `0.2em`.

### Spacing
- Card border-radius: `14px`. Card border: `1px solid rgba(255,255,255,0.10)`.
- Pending row body padding: `8px 16px 9px 4px`. Resolved rows use the same flush full-width layout (no inset, no per-row border — tint + rail only).
- Row grid: `grid-template-columns: 2px 1fr` (rail + body), `gap: 12px`.
- Comparison group: flex, `align-items: center`, `gap: 12px`. Cells are flex columns, `gap: 2px`. Bridge has `margin-top: 11px` to drop the arrow to the value baseline.
- Meta line `margin-top: 4px`; reasoning `margin-top: 5px`.
- Verdict pill: padding `4px 8px`, border-radius `20px`, `gap: 5–6px`.
- Filter button: padding `4px 7px 4px 8px`, border-radius `6px`, mono `9.5px/600`.
- Dropdown menu: `min-width 176px`, border-radius `9px`, padding `5px`; items border-radius `6px`, padding `6px 9px`.

### Border radius
Card `14px` · verdict pill `20px` · filter button & menu items `6px` · dropdown menu `9px` · ticker icon `9px`.

### Shadows
- Card: `0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -28px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,255,136,0.05)`.
- Dropdown menu: `0 18px 44px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.4)`.

## Assets
- **Icons** are inline SVG (check, minus, ✕ for verdicts; filter funnel; chevron; sort icons; ticker glyph). No external icon files — recreate with your icon library or keep as inline SVG.
- **Sparkline** in the header is rendered from `chart-data.js` (sample data) — not part of this redesign; use your existing chart component.
- **Fonts:** Space Grotesk, Inter, JetBrains Mono (Google Fonts). Use your app's equivalent mono/sans if it has them.

## Files
- `Prediction Cards.html` — the full design reference (markup, CSS tokens, and the render logic for rows, sections, filter, ring, and arrow). Everything above is implemented here. The relevant logic lives in the inline `<script>`: `pendingRowHTML`, `resolvedRowHTML`, `metaHTML`, `predictedDisplay`, `arrowSVG`, `timeRing`, and the filter/sort handlers.
