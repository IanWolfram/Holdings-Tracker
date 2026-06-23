import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pulse | Privacy Policy",
};

const H1 = "font-[family-name:var(--font-headline)] text-2xl text-[var(--color-on-surface)]";
const H2 = "font-[family-name:var(--font-headline)] text-lg text-[var(--color-on-surface)] mt-8 mb-2";

const EFFECTIVE = "June 9, 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1 className={H1}>Privacy Policy</h1>
      <p className="text-xs text-[var(--color-ink-dimmer)]">Effective {EFFECTIVE}</p>

      <p>
        This Privacy Policy explains what data Pulse collects, how it is used, and the choices you
        have. By using Pulse you agree to this policy.
      </p>

      <h2 className={H2}>What we collect</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Account data</strong> — your email address and authentication credentials (managed
          by our authentication provider).
        </li>
        <li>
          <strong>Brokerage data</strong> — positions, balances, and (where you enable it) trading
          activity retrieved from brokerage accounts you connect, via brokerage APIs and aggregation
          providers.
        </li>
        <li>
          <strong>Generated data</strong> — forecasts, prediction outcomes, calibration records, and
          notes the Service creates while serving you.
        </li>
        <li>
          <strong>Usage data</strong> — basic activity timestamps (e.g. last seen, last refresh) and
          standard server logs.
        </li>
      </ul>

      <h2 className={H2}>How we use it</h2>
      <p>
        We use your data solely to operate the Service for you: to display your portfolio, generate
        market intelligence, and improve forecast calibration. We do not sell your personal or
        financial data.
      </p>

      <h2 className={H2}>How it is stored and isolated</h2>
      <p>
        Your data is stored in a database with row-level security so that each account can only access
        its own records. Brokerage access tokens are encrypted at the application layer before
        storage. See{" "}
        <span className="text-[var(--color-on-surface)]">docs/data-handling.md</span> in our
        repository for technical detail.
      </p>

      <h2 className={H2}>Third parties</h2>
      <p>
        We rely on third-party providers for authentication and data storage, brokerage connectivity
        and aggregation, market data and news, and AI-based classification. These providers process
        data only to deliver their part of the Service and are bound by their own terms.
      </p>

      <h2 className={H2}>Retention and deletion</h2>
      <p>
        We retain your data while your account is active. You may request deletion of your account and
        associated data at any time; upon deletion we remove your account records, encrypted brokerage
        tokens, and generated data, subject to any legal retention obligations.
      </p>

      <h2 className={H2}>Your choices</h2>
      <p>
        You can disconnect a brokerage at any time, which revokes our ongoing access to that account.
        You can also delete your account to remove your data.
      </p>

      <h2 className={H2}>Contact</h2>
      <p>
        For privacy questions or deletion requests, contact the operator of this Pulse instance.
      </p>

      <p className="mt-8 text-xs text-[var(--color-ink-dimmer)]">
        This policy is a draft pending review by qualified legal counsel and does not itself
        constitute legal advice.
      </p>
    </>
  );
}
