import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pulse | Disclaimer",
};

const H1 = "font-[family-name:var(--font-headline)] text-2xl text-[var(--color-on-surface)]";
const H2 = "font-[family-name:var(--font-headline)] text-lg text-[var(--color-on-surface)] mt-8 mb-2";

const EFFECTIVE = "June 9, 2026";

export default function DisclaimerPage() {
  return (
    <>
      <h1 className={H1}>Disclaimer</h1>
      <p className="text-xs text-[var(--color-ink-dimmer)]">Effective {EFFECTIVE}</p>

      <p>
        Pulse is an informational market-intelligence tool. The content it presents — including
        aggregated positions, news, sentiment scores, congressional and insider trade data,
        directional forecasts, and BUY/SELL/HOLD indicators — is provided for general informational
        and educational purposes only. It is <strong>not investment advice</strong>, not a
        recommendation to buy, sell, or hold any security, and not a solicitation or offer to do so.
      </p>

      <h2 className={H2}>Not personalized advice</h2>
      <p>
        Pulse does not provide personalized investment advice. The signals and forecasts you see are
        generated algorithmically from public market data and are the same impersonal outputs shown
        to every user for a given security and time horizon. They do not account for your individual
        financial situation, objectives, risk tolerance, or needs. Pulse is not acting as your
        fiduciary, broker-dealer, or investment adviser.
      </p>

      <h2 className={H2}>No registered adviser or broker-dealer relationship</h2>
      <p>
        Pulse is not a registered investment adviser, broker-dealer, or financial planner. Nothing
        on this platform creates an advisory or fiduciary relationship between you and Pulse. You are
        solely responsible for your own investment decisions. Consult a licensed financial
        professional before making any investment.
      </p>

      <h2 className={H2}>Forecasts are experimental and self-reported</h2>
      <p>
        The directional forecasting engine scores its own past predictions against actual price
        movement. Any accuracy, hit-rate, or calibration figures shown are{" "}
        <strong>self-reported, unaudited, and not independently verified</strong>. Past performance
        of the model — or of any security — does not guarantee or indicate future results. Forecasts
        may be wrong, and you should not rely on them.
      </p>

      <h2 className={H2}>Data may be inaccurate or delayed</h2>
      <p>
        Market data, news, brokerage positions, and third-party datasets (including congressional and
        insider trade filings) are obtained from external sources and may be incomplete, delayed, or
        inaccurate. Pulse does not warrant the accuracy, completeness, or timeliness of any data.
      </p>

      <h2 className={H2}>No liability</h2>
      <p>
        To the maximum extent permitted by law, Pulse and its operators are not liable for any losses
        or damages arising from your use of the platform or reliance on any information it provides.
        You use Pulse at your own risk.
      </p>

      <p className="mt-8 text-xs text-[var(--color-ink-dimmer)]">
        This disclaimer is a draft pending review by qualified legal counsel and does not itself
        constitute legal advice.
      </p>
    </>
  );
}
