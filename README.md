# 📊 Holdings Tracker

A real-time financial portfolio tracking dashboard built with **Next.js 16**, **React 19**, and **Tailwind CSS 4**. It aggregates positions from **E*TRADE**, fetches market news from **Finnhub** and **Twitter/X**, and uses **Ollama (Gemma 3)** to classify news sentiment and impact.

---

## ✨ Features

- **🔄 Real-time Portfolio Sync**: Fetches live stock and option positions directly from your E*TRADE account.
- **📰 News Aggregator**: Pulls the latest headlines from Finnhub and Twitter (X) for every ticker in your portfolio.
- **🧠 AI Classification**: Uses Local LLMs (via Ollama) to analyze news headlines and summaries, categorizing them by sentiment (Bullish/Bearish) and impact level.
- **📱 Responsive Dashboard**: A sleek, dark-mode interface designed for high-density information display.
- **🔔 Telegram Integration**: Capability to send alerts and digests directly to a Telegram bot.
- **🛡️ Secure Auth**: Handles the complex OAuth 1.0a flow required by E*TRADE APIs.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **UI**: [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/)
- **State Management**: [SWR](https://swr.vercel.app/) (for data fetching/caching)
- **AI Engine**: [Ollama](https://ollama.com/) (running `gemma3:12b`)
- **API Clients**: Axios, OAuth-1.0a
- **External APIs**: E*TRADE, Finnhub, Twitter/X, Telegram

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20+ recommended.
- **Ollama**: Must be running locally or accessible via URL.
- **E*TRADE Developer Account**: You need a Consumer Key and secret.

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

4. **Authenticate with E*TRADE**:
   E*TRADE tokens expire daily at midnight ET. Run the interactive auth script to link your account:
   ```bash
   npm run etrade:auth
   ```
   *Follow the URL provided in the console, log in, and paste the verification code back into the terminal.*

### Development

Start the Next.js development server:
```bash
npm run dev
```
Navigate to `http://localhost:3000` to view your dashboard.

---

## ⚠️ Disclaimer

This application is for **tracking purposes only**. It does not provide financial advice, nor does it allow for the placement of trades. Use at your own risk.

---

## 📝 License

Internal Project - All Rights Reserved.
