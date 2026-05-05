# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Pulse** (Holdings Tracker) — a real-time financial portfolio dashboard that aggregates E*TRADE positions, fetches news from Finnhub, Polygon, and NewsAPI, and classifies sentiment using a hardware-native Apple MLX AI engine. Built with Next.js 16 App Router, React 19, Tailwind CSS 4, SWR, and Framer Motion.

## Commands

```bash
npm run dev           # Start Next.js dev server (localhost:3000)
npm run build         # Production build
npm run lint          # ESLint via Next.js
npm run etrade:auth   # Interactive OAuth flow for E*TRADE tokens
npm run agent         # CLI: Full portfolio intelligence analysis
npm run world:refresh # CLI: Force a 3D globe intelligence update
```

No test framework is configured. There are no test commands.

## Environment Modes

`ETRADE_ENV` controls the data source:
- `mock` — returns hardcoded positions and news without any API calls
- `sandbox` — uses E*TRADE sandbox API (requires OAuth tokens)
- `live` — uses E*TRADE production API (requires OAuth tokens)

When OAuth tokens are missing or expired, `getPositionsSafe()` automatically falls back to mock data with a console warning. The news pipeline similarly falls back to `MOCK_NEWS` when Finnhub/Twitter API keys are absent.

## Architecture

### Data Flow

```
E*TRADE API ──→ lib/etrade.ts ──→ /api/positions ──→ Dashboard (SWR polling every 5 min)
                                         │
Finnhub API ──→ lib/finnhub.ts ─┐
                                 ├→ lib/news.ts ──→ /api/news?ticker=X ──→ PositionCard → NewsCard
Polygon API ──→ lib/polygon.ts ─┤        │
                                 └→ lib/classifier.ts → lib/world-brain/brain.ts (MLX Native) ──→ VerdictBadge
```

- **`app/page.tsx`** — Client component (Dashboard) that polls `/api/positions`, then fetches news per ticker via `/api/news`. Uses `useCallback`/`useEffect` with `setInterval` for auto-refresh.
- **`pages/api/`** — Next.js API routes (Pages Router). These coexist with the App Router.
- **`lib/etrade.ts`** — E*TRADE OAuth 1.0a client with in-memory 5-min cache. `getPositionsSafe()` is the main entry point with fallback logic.
- **`lib/news.ts`** — Orchestrates news fetching + classification per ticker with its own 5-min cache.
- **`lib/classifier.ts`** — Thin wrapper that delegates to the unified brain in `lib/world-brain/brain.ts`. Also owns the global inference semaphore (`withInferenceSemaphore`) that serializes all local GPU calls.
- **`lib/world-brain/brain.ts`** — The hardware-native MLX inference entry point (`DeepSeek-R1-Distill-Qwen` by default). One call per story produces both a trading verdict (BUY/SELL/HOLD + confidence + reason) and geographic/sector context (origin country, relevance score, sector tags). Prompt is loaded from `world-brain/AGENT.md` and `sector-rules.md`.
- **`lib/telegram.ts`** — Builds and sends Markdown-formatted digest messages via Telegram Bot API.
- **`lib/mock-news.ts`** — Hardcoded news stories keyed by ticker, matching the mock positions.
- **`instrumentation.ts`** — Root bootstrapper for the Next.js runtime. Schedules the hourly `node-cron` job for the world-view refresh using a global singleton guard to prevent duplicate jobs during HMR.
- **`scripts/agent.ts`** — CLI tool that runs the unified brain analysis across the entire portfolio, passing full holdings context for cross-ticker impact reasoning.

### UI Components

- **`TopBar`** — Sticky header with brand, nav tabs (Terminal/Holdings/Analyst/Alerts), market status indicator, and refresh button.
- **`PositionCard`** — Card per ticker showing market value, P/L, and a verdict bar (proportional BUY/SELL/HOLD). Expandable news feed with show-more toggle.
- **`NewsCard`** — Heavily animated card using Framer Motion. Features physics-based SVG borders that react to mouse proximity (pull/tension on edges), a scanline reveal animation, and flashlight-style radial gradients. Uses `useSpring`, `useMotionValue`, and `useTransform` for reactive SVG paths.
- **`VerdictBadge`** — Color-coded BUY/SELL/HOLD badge with confidence percentage.

### Key Design Decisions

- **Dual routing**: App Router (`app/`) for the dashboard page, Pages Router (`pages/api/`) for API routes. The App Router layout loads Google Fonts (Space Grotesk, Inter, JetBrains Mono) and Material Symbols.
- **Tailwind CSS 4** with `@theme` directives in `globals.css` defining design tokens (surface colors, fonts). The tailwind.config.ts extends with custom buy/sell/hold colors.
- **5-minute caching** in both `lib/etrade.ts` and `lib/news.ts` using simple `Map`-based in-memory caches with TTL.
- **OAuth token expiry**: E*TRADE tokens expire daily at midnight ET. Re-run `npm run etrade:auth` each morning.

## External Dependencies

- **Apple MLX** must be serving via the local API server (started via `./scripts/mlx-server.sh`) at `MLX_BASE_URL` (default `http://localhost:8080/v1`) with the `MLX_MODEL` pulled and available. Set `AI_ENGINE=mlx` in `.env.local` to activate hardware-native inference.