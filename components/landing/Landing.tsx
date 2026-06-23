"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import SentimentBar from "@/components/bars/SentimentBar";

// Public marketing landing (rendered at "/" for unauthenticated visitors;
// middleware sends authed users straight to /terminal). Positioning is
// deliberately informational — Pulse surfaces market intelligence, never trade
// instructions — to stay consistent with the disclaimer + adviser-risk posture.

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const } }),
};

function Wordmark() {
  return (
    <div className="flex flex-col leading-none">
      <span className="font-[family-name:var(--font-headline)] font-bold text-white text-[20px] tracking-[-0.02em]">
        Pulse
      </span>
      <span className="font-mono text-[8px] font-medium uppercase tracking-[0.26em] text-[var(--color-ink-dimmer)] mt-[3px]">
        Precision Ledger
      </span>
    </div>
  );
}

const FEATURES: { tag: string; title: string; body: string; accent: string; href?: string }[] = [
  {
    tag: "Aggregation",
    title: "Every account, one terminal",
    body: "Connect E∗TRADE, Schwab, Robinhood, Fidelity and more through SnapTrade. Your whole portfolio — positions, balances, P/L — in a single live view.",
    accent: "#52C4C2",
  },
  {
    tag: "Accountability",
    title: "Forecasts that grade themselves",
    body: "Our directional engine scores its own past calls against what actually happened — hit-rate by horizon and confidence, tracked over time. Honesty as a feature.",
    accent: "#00FF88",
  },
  {
    tag: "Edge",
    title: "Signal you won’t find in a spreadsheet",
    body: "Congressional trades from official filings, insider activity, macro regime, and news sentiment — fused per ticker into one confidence-weighted read.",
    accent: "#8b3fc4",
  },
  {
    tag: "Clarity",
    title: "Intelligence, not instructions",
    body: "Impersonal, directional market analysis presented identically to every reader. Informational only — Pulse is not an adviser and never tells you what to trade.",
    accent: "#2196f3",
  },
];

export default function Landing() {
  return (
    <main className="relative flex flex-col w-full overflow-x-hidden text-[var(--color-on-surface)]">
      {/* ambient gradient wash */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(900px 500px at 75% -5%, rgba(139,63,196,0.16), transparent 60%), radial-gradient(700px 500px at 10% 10%, rgba(33,150,243,0.12), transparent 55%)",
        }}
      />

      {/* ── Nav ── */}
      <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark />
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-dim)] transition-colors hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md border border-[var(--color-rule-strong)] bg-white/5 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-white/10"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-12 md:grid-cols-[1.1fr_0.9fr] md:pt-20">
        <div>
          <motion.div
            variants={fadeUp} initial="hidden" animate="show" custom={0}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--color-rule)] bg-white/[0.03] px-3 py-1"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-positive)] shadow-[0_0_8px_var(--color-positive)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">
              Free beta — multi-broker
            </span>
          </motion.div>

          <motion.h1
            variants={fadeUp} initial="hidden" animate="show" custom={1}
            className="font-[family-name:var(--font-headline)] text-[clamp(2.2rem,5.5vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.02em] text-white"
          >
            All your brokerages.
            <br />
            One <span className="gradient-text">intelligent</span> terminal.
          </motion.h1>

          <motion.p
            variants={fadeUp} initial="hidden" animate="show" custom={2}
            className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-ink-dim)]"
          >
            Pulse aggregates every account in one place, then fuses news sentiment,
            congressional trades, insider activity and macro into accountable,
            self-scored forecasts. Market intelligence — never a trade instruction.
          </motion.p>

          <motion.div
            variants={fadeUp} initial="hidden" animate="show" custom={3}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/signup"
              className="rounded-md bg-white px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-black transition-transform hover:scale-[1.02]"
            >
              Connect your brokerage — free
            </Link>
            <Link
              href="#how"
              className="rounded-md border border-[var(--color-rule-strong)] px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--color-ink)] transition-colors hover:bg-white/5"
            >
              How it works
            </Link>
          </motion.div>
          <motion.p
            variants={fadeUp} initial="hidden" animate="show" custom={4}
            className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-dimmer)]"
          >
            No card required · Read-only brokerage link · Disconnect anytime
          </motion.p>
        </div>

        {/* Product visual — a real component (SentimentBar) over a mock position */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="show" custom={3}
          className="relative"
        >
          <div className="rounded-2xl border border-[var(--color-rule)] bg-black/50 p-5 shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex flex-col leading-tight">
                <span className="font-[family-name:var(--font-headline)] text-lg font-bold text-white">NVDA</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-dimmer)]">
                  Nvidia Corp · 120 sh
                </span>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold text-[var(--color-positive)]">+$4,812</div>
                <div className="font-mono text-[10px] text-[var(--color-ink-dim)]">+12.4%</div>
              </div>
            </div>
            <SentimentBar buy={7} hold={2} sell={1} sentimentScore={78} sentimentDirection="bull" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { k: "7d forecast", v: "▲ 3.4%", c: "var(--color-positive)" },
                { k: "Confidence", v: "78%", c: "#fff" },
                { k: "Congress 30d", v: "2 buys", c: "#52C4C2" },
              ].map((s) => (
                <div key={s.k} className="rounded-lg border border-[var(--color-rule)] bg-white/[0.02] px-3 py-2">
                  <div className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-[var(--color-ink-dimmer)]">{s.k}</div>
                  <div className="mt-1 font-mono text-[13px] font-bold" style={{ color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[8.5px] leading-snug text-[var(--color-ink-dimmer)]">
              Illustrative. News-sentiment signal, informational only — not investment advice.
            </p>
          </div>
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section id="how" className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16">
        <h2 className="mb-10 font-[family-name:var(--font-headline)] text-2xl font-bold tracking-[-0.01em] text-white">
          Built to be the sharpest, most honest read on your holdings.
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-[var(--color-rule)] bg-white/[0.02] p-6 transition-colors hover:border-[var(--color-rule-strong)]"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: f.accent, boxShadow: `0 0 8px ${f.accent}` }} />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">{f.tag}</span>
              </div>
              <h3 className="mb-2 font-[family-name:var(--font-headline)] text-lg font-bold text-white">{f.title}</h3>
              <p className="text-[13.5px] leading-relaxed text-[var(--color-ink-dim)]">{f.body}</p>
              {f.href && (
                <Link
                  href={f.href}
                  className="mt-3 inline-block font-mono text-[11px] uppercase tracking-[0.12em] text-white underline-offset-4 transition-colors hover:underline"
                  style={{ color: f.accent }}
                >
                  See the track record →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 pt-8">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-rule)] bg-gradient-to-br from-white/[0.06] to-transparent p-10 text-center">
          <h2 className="font-[family-name:var(--font-headline)] text-[clamp(1.6rem,4vw,2.4rem)] font-bold leading-tight tracking-[-0.02em] text-white">
            See your portfolio the way an analyst would.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[14px] text-[var(--color-ink-dim)]">
            Connect a brokerage in one click and get your first forecasts in minutes. Free during beta.
          </p>
          <Link
            href="/signup"
            className="mt-7 inline-block rounded-md bg-white px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-black transition-transform hover:scale-[1.02]"
          >
            Get started — free
          </Link>
        </div>
      </section>
    </main>
  );
}
