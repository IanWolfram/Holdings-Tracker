export interface SuggestedPrompt {
  title: string;
  meta: string;
}

export interface PromptCategory {
  cat: string;
  icon: string;
  items: SuggestedPrompt[];
}

export const SUGGESTED_PROMPTS: PromptCategory[] = [
  {
    cat: "HOLDINGS",
    icon: "account_balance_wallet",
    items: [
      { title: "Where am I most exposed to a rate cut?", meta: "Cross-references positions × FOMC scenarios" },
      { title: "What's dragging my portfolio this week?", meta: "Attributes return to position, sector, factor" },
      { title: "Rebalance toward a 60/30/10 target", meta: "Generates trade list with tax-lot awareness" },
    ],
  },
  {
    cat: "MARKET",
    icon: "public",
    items: [
      { title: "Summarize today's top-moving stories", meta: "Reads your feed · flags high-impact items" },
      { title: "Where is institutional money rotating?", meta: "13F deltas, dark-pool prints, sector flows" },
      { title: "What did the Fed actually say yesterday?", meta: "Reads transcript, flags hawkish/dovish shifts" },
    ],
  },
  {
    cat: "STOCKS",
    icon: "candlestick_chart",
    items: [
      { title: "Build a thesis on NVDA into earnings", meta: "8-K, sell-side notes, options skew, IV crush risk" },
      { title: "Compare AAPL vs MSFT on FCF yield", meta: "10 quarters · normalized · with peers" },
      { title: "Find names with a similar setup to PLTR", meta: "Technical + fundamental pattern match" },
    ],
  },
];

export interface QuickAction {
  id: string;
  icon: string;
  label: string;
  sub: string;
  prompt: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "risk", icon: "shield", label: "Run risk scan", sub: "Stress my positions", prompt: "Run a risk scan across my holdings and stress-test my biggest exposures." },
  { id: "digest", icon: "summarize", label: "Morning digest", sub: "Overnight news + premarket", prompt: "Give me my morning digest: overnight news and premarket moves on my holdings." },
  { id: "rebal", icon: "tune", label: "Rebalance check", sub: "Drift vs target weights", prompt: "Check my portfolio for drift versus target weights and suggest a rebalance." },
  { id: "alert", icon: "notifications_active", label: "Set a price alert", sub: "On any ticker or condition", prompt: "Help me set a price alert. Ask me for the ticker and the condition." },
];

// agent_job kind → display metadata for the "Watching for you" scan cards.
// Cadence/coverage are human-readable mirrors of the DEFAULT_CRON in
// pages/api/agent/jobs.ts; the live row supplies status, summary, and timing.
export interface ScanDefinition {
  kind: string;
  name: string;
  cadence: string;
  coverage: string;
  defaultNote: string;
}

export const SCAN_DEFINITIONS: ScanDefinition[] = [
  { kind: "morning_digest", name: "Morning digest", cadence: "Every day · 06:30 ET", coverage: "Holdings", defaultNote: "Not yet enabled — turn on for a daily pre-market sweep with signals." },
  { kind: "earnings_watch", name: "Earnings watch", cadence: "Every weekday · 06:30 ET", coverage: "Holdings", defaultNote: "Not yet enabled — turn on to track upcoming reports." },
  { kind: "concentration_risk", name: "Concentration & risk", cadence: "Every Monday · 08:00 ET", coverage: "Portfolio-wide", defaultNote: "Not yet enabled — turn on for weekly concentration checks." },
  { kind: "congress", name: "Congressional disclosures", cadence: "Hourly · STOCK Act filings", coverage: "Watchlist + holdings", defaultNote: "Not yet enabled — turn on to watch new filings." },
  { kind: "story_backlog", name: "Story analysis backlog", cadence: "Every 15 min · triggered by feed", coverage: "All feeds", defaultNote: "Not yet enabled — turn on to process queued stories." },
];
