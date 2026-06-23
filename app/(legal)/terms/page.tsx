import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pulse | Terms of Service",
};

const H1 = "font-[family-name:var(--font-headline)] text-2xl text-[var(--color-on-surface)]";
const H2 = "font-[family-name:var(--font-headline)] text-lg text-[var(--color-on-surface)] mt-8 mb-2";
const A = "text-[var(--color-positive)] hover:underline";

const EFFECTIVE = "June 9, 2026";

export default function TermsPage() {
  return (
    <>
      <h1 className={H1}>Terms of Service</h1>
      <p className="text-xs text-[var(--color-ink-dimmer)]">Effective {EFFECTIVE}</p>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Pulse (the
        &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these Terms
        and to our{" "}
        <Link href="/privacy" className={A}>
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/disclaimer" className={A}>
          Disclaimer
        </Link>
        . If you do not agree, do not use the Service.
      </p>

      <h2 className={H2}>1. Eligibility</h2>
      <p>
        You must be at least 18 years old and capable of forming a binding contract to use the
        Service. You are responsible for keeping your account credentials secure and for all activity
        under your account.
      </p>

      <h2 className={H2}>2. Informational use only</h2>
      <p>
        The Service provides informational market intelligence only. It does not provide investment,
        legal, tax, or accounting advice, and it is not a broker-dealer or registered investment
        adviser. See the{" "}
        <Link href="/disclaimer" className={A}>
          Disclaimer
        </Link>{" "}
        for full details. All investment decisions are yours alone.
      </p>

      <h2 className={H2}>3. Brokerage connections</h2>
      <p>
        The Service lets you connect read access (and, where supported, trading access) to your
        third-party brokerage accounts through brokerage APIs and aggregation providers. Those
        connections are subject to the terms of your broker and the relevant aggregation provider.
        You authorize Pulse to retrieve your account data solely to provide the Service to you. Pulse
        does not place trades on your behalf without your explicit action.
      </p>

      <h2 className={H2}>4. Acceptable use</h2>
      <p>
        You agree not to misuse the Service, including: reverse-engineering it; scraping or
        redistributing data obtained through it; attempting to access other users&rsquo; data;
        circumventing rate limits or security controls; or using it for any unlawful purpose.
      </p>

      <h2 className={H2}>5. Subscriptions and billing</h2>
      <p>
        Some features may require a paid subscription. Pricing, billing terms, and any free tier will
        be disclosed at the point of purchase. Subscriptions renew until cancelled; you may cancel at
        any time, effective at the end of the current billing period, unless otherwise stated.
      </p>

      <h2 className={H2}>6. No warranty</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties
        of any kind. Pulse does not warrant that data is accurate, complete, or uninterrupted.
      </p>

      <h2 className={H2}>7. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Pulse and its operators are not liable for any
        indirect, incidental, or consequential damages, or for any investment losses, arising from
        your use of the Service.
      </p>

      <h2 className={H2}>8. Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or
        terminate access for violations of these Terms.
      </p>

      <h2 className={H2}>9. Changes</h2>
      <p>
        We may update these Terms. Material changes will be communicated through the Service.
        Continued use after changes take effect constitutes acceptance.
      </p>

      <p className="mt-8 text-xs text-[var(--color-ink-dimmer)]">
        These Terms are a draft pending review by qualified legal counsel and do not themselves
        constitute legal advice.
      </p>
    </>
  );
}
