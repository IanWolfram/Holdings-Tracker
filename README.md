# 📊 Holdings Tracker

A real-time financial portfolio tracking dashboard built with **Next.js 16**, **React 19**, and **Tailwind CSS 4**. It aggregates positions from **E\*TRADE**, fetches market news from **Finnhub** and **Twitter/X**, and uses **Native Apple MLX** to classify news sentiment and impact on Apple Silicon (M5).

---

## ✨ Features

- **🔄 Real-time Portfolio Sync**: Fetches live stock and option positions directly from your E\*TRADE account.
- **📰 News Aggregator**: Pulls the latest headlines from Finnhub and Twitter (X) for every ticker in your portfolio.
- **🧠 Unified AI Brain**: A single hardware-native LLM call (via MLX) that simultaneously classifies news sentiment (BUY/SELL/HOLD), infers geographic origin, identifies affected sectors, and scores relevance to your holdings.
- **📱 Responsive Dashboard**: A sleek, dark-mode interface designed for high-density information display.
- **🔔 Telegram Integration**: Capability to send alerts and digests directly to a Telegram bot.
- **🛡️ Secure Auth**: Handles the complex OAuth 1.0a flow required by E\*TRADE APIs.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **UI**: [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/)
- **State Management**: [SWR](https://swr.vercel.app/) (for data fetching/caching)
- **AI Engine**: [Apple MLX](https://github.com/ml-explore/mlx) (running `DeepSeek-R1-Distill-Qwen`)
- **API Clients**: Axios, OAuth-1.0a
- **External APIs**: E\*TRADE, Finnhub, Twitter/X, Telegram

---

## 🚀 Getting Started

### Quick Start (Daily Routine)

1. **Start the AI Brain**: Run `./scripts/mlx-server.sh` in a dedicated terminal.
2. **Launch Pulse**: Run `npm run dev` in another terminal.
3. **Verify Auth**: Ensure E\*TRADE tokens are active (run `npm run etrade:auth` if expired).
4. **Run the Stock Agent**: Run `npm run agent` in another terminal or click button in top right of UI.

### Prerequisites

- **Hardware**: Apple Silicon (M1+) recommended.
- **MLX Environment**: Python 3.11+ with `mlx-lm` library.
- **E\*TRADE Developer Account**: You need a Consumer Key and secret.

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/IanWolfram/Holdings-Tracker.git
   cd Holdings-Tracker
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` and fill in your API keys.

   ```bash
   cp .env.example .env.local
   ```

4. **Authenticate with E\*TRADE**:
   E\*TRADE tokens expire daily at midnight ET. Run the interactive auth script to link your account:
   ```bash
   npm run etrade:auth
   ```
   _Follow the URL provided in the console, log in, and paste the verification code back into the terminal._

### MLX Native Server

The AI Brain runs on a hardware-native local server optimized for Apple Silicon.

```bash
./scripts/mlx-server.sh  # Starts the DeepSeek-R1 inference server on port 8080
```

### Dashboard

Start the Next.js development server:

```bash
npm run dev
```

Navigate to `http://localhost:3000` to view your dashboard.

---

## 🧠 Intelligence Tools

### Stock Agent

Run a deep-intelligence sweep across your entire portfolio using the local LLM. The agent reasons about **indirect impact** (e.g., a data center fire in Taiwan affecting NVDA/AMD) and provides a beautiful terminal report.

```bash
npm run agent         # run the Stock Agent on all positions
```

### World Intelligence Refresh

The 3D globe view auto-refreshes every hour from 6am–11pm. You can also trigger it manually:

```bash
npm run world:refresh  # force a world-view refresh (requires dev server)
```

> [!TIP]
> Both tools use your live E\*TRADE positions and require the **MLX Server** to be running with the `DeepSeek-R1-Distill-Qwen` model.

---

## ⚙️ Running with pm2 (Persistent Process)

By default `npm run dev` stops when you close the terminal. Use [pm2](https://pm2.keymetrics.io/) to keep Pulse alive through sleep and terminal sessions:

```bash
npm run pm2:start      # start Pulse under pm2 (replaces npm run dev)
npm run pm2:status     # check if it's running
npm run pm2:logs       # tail live logs (incl. world-cron output)
npm run pm2:restart    # restart after config changes
npm run pm2:stop       # stop the process
```

**Auto-start on login** — run once to register pm2 with macOS launchd:

```bash
pm2 save        # snapshot the current process list
pm2 startup     # prints a command — copy and run it
```

After setup, Pulse starts automatically on login and the hourly world-cron survives sleep/wake cycles.

---

## ⚠️ Disclaimer

This application is for **tracking purposes only**. It does not provide financial advice, nor does it allow for the placement of trades. Use at your own risk.

---

## 📝 License

Internal Project - All Rights Reserved.
