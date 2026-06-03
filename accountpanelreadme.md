# Handoff: Account Panel Redesign

## Overview

A redesigned right-side **Account / Settings drawer** for the Pulse terminal
(`/terminal`). Replaces the existing flat, low-hierarchy panel with a tighter
information architecture, a hero treatment for the brokerage connection, real
input controls for preferences, and proper visual separation between sections.

Triggered the same way as the current panel (avatar click in topbar), dismissed
by `Esc` or click-outside.

---

## About the design files

The bundled HTML file (`Account Panel.html`) is a **design reference**, not
production code. It is a pixel-accurate prototype of the intended look. Your
task is to **recreate this design in the existing Pulse codebase** — the
production app appears to be React + Tailwind (based on the source DOM
captured), so re-implement using your existing components, tokens, and
patterns. Do **not** copy the HTML/CSS verbatim.

The faux blurred trading-terminal backdrop in the prototype is only there to
show the drawer in context. **Do not implement the backdrop.** The drawer
itself overlays the real `/terminal` UI.

---

## Fidelity

**High-fidelity.** Colors, type, spacing, borders, and radii are final. Match
them within the constraints of your existing Tailwind config — use design
tokens that already exist (`--positive`, `--surface`, etc.) and only add new
ones where called out below.

---

## Screen: Account Drawer

### Container

| Prop | Value |
|---|---|
| Position | `fixed`, top-0 right-0, full viewport height |
| Width | `380px` (with `max-width: calc(100vw - 48px)`) |
| Background | `rgba(18, 18, 20, 0.98)` |
| Backdrop filter | `blur(24px) saturate(170%)` |
| Border-left | `1px solid rgba(255,255,255,0.07)` |
| Shadow | `-12px 0 48px rgba(0,0,0,0.6)` |
| Layout | flex column: header (fixed) / body (scroll) / footer (fixed) |
| z-index | `60` |
| Scanline overlay | repeating 2px transparent / 1px `rgba(255,255,255,0.012)` stripes, `pointer-events:none`, on top of everything |

### Header

Layout: 18px / 18px / 16px padding, 1px bottom rule (`rgba(255,255,255,0.06)`),
subtle top-fade `linear-gradient(180deg, rgba(0,255,136,0.025), transparent 80%)`.

Two-row layout:

**Row 1 — title + actions** (`flex justify-between items-start`)
- Title: `"Account"` — Space Grotesk 700, 22px, line-height 1, letter-spacing -0.02em, color white
- Actions (right, gap 4px):
  - Sign-out button (30×30, icon `logout` from Material Symbols, 18px)
    - Default: transparent / `var(--ink-dim)` icon
    - Hover: bg `rgba(255,68,68,0.08)`, border `rgba(255,68,68,0.4)`, icon `--negative`
  - Close button (30×30, icon `close`, 18px)
    - Default: transparent / `var(--ink-dim)` icon
    - Hover: bg `rgba(255,255,255,0.05)`, border `rgba(255,255,255,0.12)`, icon white

**Row 2 — identity strip** (margin-top 14px)
- Container: 1px border `var(--rule)`, radius 8px, background `rgba(255,255,255,0.025)`, padding 10px, `flex items-center gap-12px`
- Avatar: 36×36 circle
  - Background: `radial-gradient(circle at 30% 30%, rgba(0,255,136,0.18), rgba(0,255,136,0.04) 60%, rgba(255,255,255,0.04))`
  - Border: 1px `rgba(0,255,136,0.25)`
  - Initial "W" in JetBrains Mono 700, 14px, white, letter-spacing -0.02em
- Info column:
  - Email: `wolf@pulse.local` — JetBrains Mono 500, 12px, white, ellipsis on overflow
  - Meta: `Trader · Cloud · v2.4.1` — JetBrains Mono, 9px, `var(--ink-dim)`, letter-spacing 0.18em, uppercase. Separators are 2×2 dim circles (`var(--ink-faint)`).

### Body (scrollable)

Custom thin scrollbar: 6px wide, thumb `rgba(255,255,255,0.08)` radius 3px.

Each `.section` has 18px / 18px / 22px padding and a 1px bottom rule
(`var(--rule)`). Last section has no bottom rule.

Section header pattern (`.sec-head`):
- `flex justify-between items-center`, margin-bottom 12px
- Title (left): icon (Material Symbols, 13px, `var(--ink-dimmer)`) + label
  (JetBrains Mono 700, 10px, letter-spacing 0.22em, uppercase, `var(--ink-dim)`)
- Optional aside (right): same mono 9px, letter-spacing 0.2em, uppercase. Color
  by status: default `var(--ink-dimmer)`, ok `var(--positive-dim)`, warn `#c79c4d`

---

### Section: Brokerage

**Hero connection card** (`.conn`), no aside on the section header.

Card container:
- Radius 10px, background `rgba(0,0,0,0.55)`
- `border-top: 1.5px solid rgba(0,255,136,0.55)`
- Inset shadow: `inset 0 0 0 1px rgba(255,255,255,0.04)`
- Top-glow pseudo-element (60px tall, absolute, behind content):
  `radial-gradient(ellipse 100% 60px at 50% 0%, rgba(0,255,136,0.18) 0%, rgba(0,220,110,0.04) 60%, transparent 100%)`

**Head row** (padding 14px 14px 12px, `flex justify-between items-start gap-10px`)
- Brand (left): logo tile + name stack
  - Logo: 32×32, radius 6px, gradient `linear-gradient(135deg, #6610c4 0%, #4b0c8a 60%, #2e0658 100%)`, shadow `0 4px 14px -4px rgba(102,16,196,0.7), inset 0 0 0 1px rgba(255,255,255,0.08)`. Glyph: `E` in Space Grotesk 700, 16px, color `#ffd84d`, followed by red asterisk (`#ff4d4d`).
  - Name: "E*TRADE" — Space Grotesk 700, 15px, white, letter-spacing -0.01em
  - Sub: "OAuth · prod" — JetBrains Mono 9px, letter-spacing 0.18em, uppercase, `var(--ink-dimmer)`
- Status pill (right): "Live" — bg `rgba(0,255,136,0.1)`, border `1px rgba(0,255,136,0.3)`, radius 3px, padding 4px 8px, JetBrains Mono 700, 9px, letter-spacing 0.18em, uppercase, color `var(--positive)`

**Token-life gauge** (padding 6px 14px 12px)
- Head row: label "Token life" (mono 9px tracking 0.18em uppercase `var(--ink-dim)`) + value "10h 30m" (mono 700 13px white; "m" suffix at 400 with `var(--ink-dim)`)
- Gauge: 24-cell horizontal bar, 6px tall, 2px gap between cells
  - Off cell: `rgba(255,255,255,0.05)`, radius 1px
  - On cell: `var(--positive)`, shadow `0 0 6px rgba(0,255,136,0.4)`
  - Trailing fade: last two "on" cells fade — `fade-1` at 85% alpha, `fade-2` at 60% alpha (less glow)
  - **Mapping logic**: 24 cells represents the token's max life (24h). Fill `ceil(remaining_hours)` cells; apply `fade-1` and `fade-2` to the final two filled cells so the leading edge softens as it depletes.

**Actions row** (padding 0 12px 12px, gap 6px)
- Reconnect button (flex 1): transparent, border `1px var(--rule-strong)`, radius 5px, padding 8px 10px. Icon `refresh` (13px) + label "Reconnect" (JetBrains Mono 700, 10px, letter-spacing 0.12em, uppercase). Hover: bg `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.2)`, color white.
- Disconnect icon-only button (same style, padding 8px 11px, icon `link_off`)

---

### Section: Data Sources

Aside text: `"3 / 4 active"` with warn color.

Stacked single-column list (`flex flex-col gap-6px`). Each row:

- Container (`.ds-cell`): 1px border `var(--rule)`, radius 6px, padding 10px 12px, background `rgba(255,255,255,0.015)`, `flex justify-between items-center gap-12px`
- Name (left): Space Grotesk 600, 13px, color depends on state
- Status (right): JetBrains Mono, 9px, letter-spacing 0.14em, uppercase

**Configured state (`.ds-cell.on`)**
- Border: `rgba(0,255,136,0.18)`
- Background: `linear-gradient(180deg, rgba(0,255,136,0.04), transparent 60%), rgba(255,255,255,0.015)`
- Name: white
- Status text: `var(--positive-dim)` (`#00cc6e`), label "Configured"

**Missing state (`.ds-cell.off`)**
- Border: default `var(--rule)`
- Diagonal hatch overlay (45deg, 1px stripes at 8px spacing, `rgba(255,255,255,0.015)`)
- opacity 0.85
- Name: `var(--ink-dim)`
- Status text: `var(--ink-dimmer)`, label "Missing key"

**Items (in order):** Finnhub (on), Polygon (on), NewsAPI (off), FRED (on)

---

### Section: Notifications

Aside: `"0 channels"`.

Single row (`.notif`): 1px border `var(--rule)`, radius 8px, padding 11px 12px, `flex items-center gap-10px`, bg `rgba(255,255,255,0.015)`.

- Glyph: 28×28, radius 6px, bg `rgba(255,255,255,0.04)`, border `1px var(--rule)`, icon `send` (15px, `var(--ink-dim)`)
- Name: "Telegram Bot" — Space Grotesk 600, 13px, white, flex 1
- CTA button "Set up →": transparent, border `1px var(--rule-strong)`, radius 4px, padding 5px 9px, JetBrains Mono 700, 9px, letter-spacing 0.16em, uppercase. Trailing icon `arrow_forward` (11px). Hover same pattern as other ghost buttons.

If a notification channel were configured, swap the CTA for a small status pill
matching the brokerage Live pill, and brighten the glyph.

---

### Section: Preferences

No aside. Rows are `flex justify-between items-center` with `min-height: 28px`,
gap 10px between rows.

Label is Inter 500, 12.5px, `var(--ink)`. Optional hint below label is
JetBrains Mono 9px, letter-spacing 0.14em, uppercase, `var(--ink-dimmer)`,
margin-top 3px.

**Row 1 — UI Mode** → segmented control
- Container: 1px border `var(--rule)`, bg `rgba(255,255,255,0.04)`, radius 5px, padding 2px
- Button (default): transparent, mono 700 10px tracking 0.12em uppercase, color `var(--ink-dim)`, padding 4px 10px, radius 3px
- Active button: bg `rgba(255,255,255,0.1)`, color white, shadow `0 1px 0 rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.06)`
- Options: `Compact` (default active), `Cozy`

**Row 2 & 3 — News cache / Positions cache** → stepper
- Container: 1px border `var(--rule)`, bg `rgba(255,255,255,0.03)`, radius 5px, `inline-flex items-center`
- Decrement / increment buttons: 22×24, transparent, icon `remove`/`add` (14px, `var(--ink-dim)`). Hover bg `rgba(255,255,255,0.05)`, icon white.
- Value: padding 0 8px, min-width 38px, center, JetBrains Mono 700, 11px, white
- Defaults: News cache `5m`, Positions cache `60m`
- Cache value progression (suggestion): `1m, 2m, 5m, 10m, 15m, 30m, 60m, 2h, 4h, 24h`

**Row 4 — Monthly recalibration** → toggle
- Hint text below label: "Re-runs strategy weights"
- Switch: 36×20, radius 999px, border `1px var(--rule)`, bg `rgba(255,255,255,0.08)`
  - Off thumb: 14×14, top/left 2px, `var(--ink-dim)`
  - On state: bg `rgba(0,255,136,0.18)`, border `rgba(0,255,136,0.4)`, thumb `var(--positive)` with `box-shadow: 0 0 8px rgba(0,255,136,0.5)`, translateX(16px)
  - 0.18s transition on bg / border / transform

---

### Section: Account

No aside.

**Info rows** (`flex flex-col gap-7px`, margin-bottom 12px)
- Each row: `flex justify-between items-center`, mono 11px
- Label: `var(--ink-dim)`, letter-spacing 0.04em
- Value: white, weight 500
- Items: `Created  5 / 6 / 2026`, `Last sign-in  5 / 19 / 2026` (use the actual user data)

**Actions row** (`flex gap-6px`)
- Both buttons share the ghost-button style: flex 1, padding 8px, radius 5px, transparent, mono 700 10px tracking 0.14em uppercase, icon 13px + label, `flex items-center justify-center gap-6px`.
- `Change password` (link to `/reset`): icon `key`, default border `var(--rule-strong)`, color `var(--ink)`. Hover bg `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.2)`, color white.
- `Sign out` (danger button): icon `logout`, border `rgba(255,68,68,0.3)`, color `var(--negative)`. Hover bg `rgba(255,68,68,0.08)`, border `rgba(255,68,68,0.5)`.

---

### Footer

Sticky, 10px / 14px padding, 1px top rule, bg `rgba(0,0,0,0.4)`, `flex justify-between items-center gap-10px`.

- Left meta: two chips + version
  - Chips ("Cloud"): padding 2px 6px, radius 3px, bg `rgba(255,255,255,0.04)`, color `var(--ink-dim)`, mono 9px letter-spacing 0.12em uppercase
  - Version "v2.4.1": mono 9px, `var(--ink-faint)` (`#353940`)
- Right: `Esc to dismiss`
  - `kbd` element: padding 1px 4px, 1px border `var(--rule-strong)` with bottom-width 2px, radius 3px, color `var(--ink-dim)`, bg `rgba(255,255,255,0.04)`, mono 9px
  - Trailing label "to dismiss" — mono 9px, letter-spacing 0.16em, uppercase, `var(--ink-dimmer)`

---

## Interactions & behavior

| Action | Behavior |
|---|---|
| Click outside drawer | Close drawer (existing behavior) |
| `Esc` | Close drawer (existing behavior) |
| Header close `×` | Close drawer |
| Header sign-out (red) | Sign user out + redirect to login |
| Reconnect button | Trigger E*TRADE OAuth re-auth flow |
| Disconnect (icon) | Confirm dialog → revoke E*TRADE OAuth tokens |
| `Set up →` on a missing notification channel | Open channel setup flow (Telegram BotFather guide) |
| Each data-source row | Click → opens API-key entry modal for that source |
| UI Mode segmented | Toggle compact ↔ cozy. Persist in user prefs; re-flow positions table density. |
| Cache stepper +/− | Step through preset cache durations; persist. |
| Recalibration toggle | Enable/disable monthly job; persist. |
| Change password link | Navigate to `/reset` |
| Sign out (footer) | Same as header sign-out |
| Drawer enter/exit | Match existing slide-in-from-right transition |

All hover states already specified per-component above. All transitions are 0.15s
ease (0.18s for the switch).

---

## State

Pull from existing stores; nothing new is invented in this redesign.

- `session.user` → email, avatar initial, created date, last sign-in
- `etrade.connection` → status (`connected | disconnected | expired`), token expiry timestamp
- `dataSources[]` → `{ name, configured: boolean }` for Finnhub, Polygon, NewsAPI, FRED
- `notifications[]` → list of channels with `{ name, configured: boolean }`
- `prefs` → `{ uiMode: 'compact'|'cozy', newsCacheMinutes, positionsCacheMinutes, monthlyRecalibration: boolean }`
- `env` → `{ platform: 'Cloud'|'Local', version }`

Derived for the gauge: `cellsLit = ceil((expiry - now) / hours_per_cell)` where
`hours_per_cell = 24/24 = 1` for the default 24h token. Adjust if the token
lifetime is different.

---

## Design tokens

Most exist in `app/globals.css`. Add the ones missing.

```css
/* Surfaces */
--surface:                #121214;
--surface-body:           #080809;
--surface-container-low:  #131316;
--surface-container:      #18181c;
--surface-container-high: #1f1f24;

/* Ink */
--ink:        #e8e8ea;   /* primary text */
--ink-dim:    #8a8f96;   /* secondary text */
--ink-dimmer: #555a62;   /* tertiary / micro labels */
--ink-faint:  #353940;   /* near-invisible (version string, dividers in chips) */

/* Status */
--positive:     #00ff88;
--positive-dim: #00cc6e;
--negative:     #ff4444;
--hold:         #64748b;

/* Rules */
--rule:        rgba(255,255,255,0.06);
--rule-strong: rgba(255,255,255,0.12);

/* Fonts */
--font-headline: "Space Grotesk", sans-serif;
--font-body:     "Inter",          sans-serif;
--font-mono:     "JetBrains Mono", monospace;
```

Spacing scale used: 2, 4, 6, 7, 8, 10, 11, 12, 14, 18, 22 (px). Map to your
Tailwind scale.

Border radii: 3, 4, 5, 6, 8, 10, 50% (avatar) px.

---

## Assets

- **Icons**: Material Symbols Outlined (already in app). Names used:
  `logout, close, link, refresh, link_off, database, notifications, send,
  arrow_forward, tune, remove, add, shield_person, key`
- **Fonts**: Inter, Space Grotesk, JetBrains Mono (already loaded).
- **No images.** The E\*TRADE logo tile is a CSS gradient + glyph; replace with
  the real brand mark if you have rights to use it.

---

## Files

- `Account Panel.html` — the design reference. Open it in a browser to inspect
  computed styles, hover states, and interaction affordances. Look at the
  drawer (`<aside class="drawer">`) only; ignore everything inside `.backdrop`.

---

## What changed vs. the old panel

For PR context — the redesign:

1. Promoted profile/email/env into a single identity strip in the header
   (was a buried row).
2. Replaced the flat E\*TRADE row with a hero card: glow border, brand mark,
   live pill, 24-cell token gauge, paired reconnect + disconnect buttons.
3. Cut the AI Engine section entirely.
4. Data sources: kept stacked list but added per-row state (green tint for
   configured, hatched + dimmed for missing) and a `3 / 4 active` aside.
5. Notifications: missing channels get an inline `Set up →` CTA.
6. Preferences: dead labels became real controls (segmented for UI Mode,
   steppers for caches, switch for recalibration).
7. Account: dates as inline rows; password / sign-out as paired ghost
   buttons (sign-out in danger red).
8. Footer: collapsed environment info into chips; `Esc` rendered as a kbd.
9. Type sizes raised across the board (was 9–11px label-soup; now
   labels 9–10px but values 11–15px for proper hierarchy).
