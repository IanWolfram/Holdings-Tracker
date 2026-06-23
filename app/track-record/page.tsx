import Link from "next/link";
import { getAggregateTrackRecord } from "@/lib/track-record";

// Public, impersonal forecasting track record — the differentiator: our engine
// scores its own past calls and shows the receipts. Rendered at request time so
// it reads live aggregate data (cached 1h in lib/track-record). Not prerendered
// at build (no DB/secrets there).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Track Record | Pulse",
  description: "How Pulse's directional forecasts have actually performed — self-scored, by horizon and confidence.",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const PRELIMINARY_BELOW = 30; // below this many resolved calls, label everything preliminary

function Wordmark() {
  return (
    <Link href="/" className="flex flex-col leading-none">
      <span className="font-[family-name:var(--font-headline)] font-bold text-white text-[20px] tracking-[-0.02em]">Pulse</span>
      <span className="font-mono text-[8px] font-medium uppercase tracking-[0.26em] text-[var(--color-ink-dimmer)] mt-[3px]">Precision Ledger</span>
    </Link>
  );
}

function rateColor(r: number): string {
  if (r >= 0.6) return "var(--color-positive)";
  if (r >= 0.5) return "#e8e8ea";
  return "var(--color-negative)";
}

export default async function TrackRecordPage() {
  const tr = await getAggregateTrackRecord();
  const hasData = tr.totalResolved > 0;
  const preliminary = tr.totalResolved < PRELIMINARY_BELOW;

  return (
    <main className="relative flex w-full flex-col text-[var(--color-on-surface)]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: "radial-gradient(800px 460px at 80% -5%, rgba(0,255,136,0.10), transparent 60%)" }}
      />

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Wordmark />
        <div className="flex items-center gap-3">
          <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-dim)] transition-colors hover:text-white">Home</Link>
          <Link href="/signup" className="rounded-md border border-[var(--color-rule-strong)] bg-white/5 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-white/10">Get started</Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-24 pt-8">
        {/* Header */}
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-rule)] bg-white/[0.03] px-3 py-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">Self-scored · Unaudited</span>
        </div>
        <h1 className="font-[family-name:var(--font-headline)] text-[clamp(2rem,5vw,3rem)] font-bold leading-[1.05] tracking-[-0.02em] text-white">
          We grade our own forecasts.
          <br />
          Here are the <span className="gradient-text">receipts</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-ink-dim)]">
          Every directional forecast Pulse makes is dated, stored, and later scored against
          what the stock actually did at the horizon close. No cherry-picking — this is the
          full resolved record, aggregated across all tickers and users. Numbers are
          self-reported and independently unaudited.
        </p>

        {!hasData ? (
          <div className="mt-10 rounded-xl border border-[var(--color-rule)] bg-white/[0.02] p-8 text-center">
            <div className="font-[family-name:var(--font-headline)] text-xl font-bold text-white">The track record is being built.</div>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] text-[var(--color-ink-dim)]">
              Forecasts resolve as their horizons arrive (1, 7, and 30 days). Check back as
              the first predictions are scored — we’ll show every result here, win or lose.
            </p>
          </div>
        ) : (
          <>
            {preliminary && (
              <div className="mt-8 rounded-lg border border-[var(--color-rule)] bg-[rgba(234,179,8,0.06)] px-4 py-2.5 font-mono text-[11px] text-[#eab308]">
                Preliminary — only {tr.totalResolved} forecasts resolved so far. Treat these
                rates as early signal, not a stable long-run average.
              </div>
            )}

            {/* Headline stats */}
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--color-rule)] bg-white/[0.02] p-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">Directional hit rate</div>
                <div className="mt-2 font-[family-name:var(--font-headline)] text-4xl font-bold" style={{ color: rateColor(tr.overall.winRate) }}>
                  {pct(tr.overall.winRate)}
                </div>
                <div className="mt-1 font-mono text-[11px] text-[var(--color-ink-dimmer)]">correct direction at horizon</div>
              </div>
              <div className="rounded-xl border border-[var(--color-rule)] bg-white/[0.02] p-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">Forecasts scored</div>
                <div className="mt-2 font-[family-name:var(--font-headline)] text-4xl font-bold text-white">{tr.totalResolved.toLocaleString()}</div>
                <div className="mt-1 font-mono text-[11px] text-[var(--color-ink-dimmer)]">resolved against real closes</div>
              </div>
              <div className="rounded-xl border border-[var(--color-rule)] bg-white/[0.02] p-6">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-dim)]">Last updated</div>
                <div className="mt-2 font-[family-name:var(--font-headline)] text-xl font-bold text-white">
                  {tr.updatedAt ? new Date(tr.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—"}
                </div>
                <div className="mt-1 font-mono text-[11px] text-[var(--color-ink-dimmer)]">resolution runs daily</div>
              </div>
            </div>

            {/* By horizon */}
            {tr.byHorizon.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-4 font-[family-name:var(--font-headline)] text-lg font-bold text-white">By forecast horizon</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {tr.byHorizon.map((b) => (
                    <div key={b.key} className="rounded-xl border border-[var(--color-rule)] bg-white/[0.02] p-5">
                      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--color-ink-dim)]">{b.key}-day</div>
                      <div className="mt-2 font-[family-name:var(--font-headline)] text-3xl font-bold" style={{ color: rateColor(b.winRate) }}>{pct(b.winRate)}</div>
                      <div className="mt-1 font-mono text-[10px] text-[var(--color-ink-dimmer)]">{b.n.toLocaleString()} scored · avg conf {pct(b.avgConfidence)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence calibration */}
            {tr.byConfidenceBucket.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-1 font-[family-name:var(--font-headline)] text-lg font-bold text-white">Is the confidence honest?</h2>
                <p className="mb-4 max-w-2xl text-[13px] text-[var(--color-ink-dim)]">
                  A well-calibrated model is right about as often as it claims. Each row shows
                  how forecasts in a stated-confidence band actually resolved.
                </p>
                <div className="overflow-hidden rounded-xl border border-[var(--color-rule)]">
                  {tr.byConfidenceBucket.map((b, i) => (
                    <div
                      key={b.key}
                      className="flex items-center gap-4 px-5 py-3"
                      style={{ background: i % 2 ? "rgba(255,255,255,0.015)" : "transparent" }}
                    >
                      <div className="w-24 flex-shrink-0 font-mono text-[12px] text-[var(--color-ink)]">
                        {pct(parseFloat(b.key.split("-")[0]))}–{pct(parseFloat(b.key.split("-")[1]))}
                      </div>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(b.winRate), background: rateColor(b.winRate) }} />
                      </div>
                      <div className="w-12 flex-shrink-0 text-right font-mono text-[12px] font-bold" style={{ color: rateColor(b.winRate) }}>{pct(b.winRate)}</div>
                      <div className="w-16 flex-shrink-0 text-right font-mono text-[10px] text-[var(--color-ink-dimmer)]">{b.n.toLocaleString()} n</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Methodology + CTA */}
        <div className="mt-12 rounded-xl border border-[var(--color-rule)] bg-white/[0.02] p-6">
          <h3 className="font-[family-name:var(--font-headline)] text-base font-bold text-white">How a forecast is scored</h3>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[var(--color-ink-dim)]">
            For each ticker and horizon the engine commits to a direction (up, down, or flat)
            and a confidence. When the horizon date’s close arrives, the prediction is resolved
            against the actual move, with a volatility-scaled flat band so tiny moves count as
            flat. A call is &ldquo;correct&rdquo; when the realized direction matches. Nothing is back-filled
            or revised after the fact.
          </p>
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-[var(--color-ink-dimmer)]">
            Informational only — not investment advice, not a guarantee of future results.
            Past performance does not predict future returns. Figures are self-reported and unaudited.
          </p>
          <Link href="/signup" className="mt-5 inline-block rounded-md bg-white px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-black transition-transform hover:scale-[1.02]">
            Track your portfolio — free
          </Link>
        </div>
      </section>
    </main>
  );
}
