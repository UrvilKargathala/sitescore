import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — SiteScore",
  description: "How SiteScore collects, uses, retains, and deletes your personal data.",
};

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-20">
      <article className="w-full max-w-2xl">

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-8 focus:outline-none focus:text-gray-300"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to SiteScore
        </Link>

        <h1
          className="text-3xl sm:text-4xl font-bold text-white mb-3"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-500 mb-10" style={{ fontFamily: "var(--font-manrope)" }}>
          Last updated: June 2026 · Operated by Centr8 (centr8.com)
        </p>

        <div className="space-y-8 text-gray-400 text-sm leading-7" style={{ fontFamily: "var(--font-manrope)" }}>

          <section>
            <h2 className="text-base font-bold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              What we collect and why
            </h2>
            <p>
              SiteScore collects the minimum data needed to operate the service:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>
                <strong className="text-gray-300">URL you submit</strong> — used to run the scan.
                Stored with the scan result for caching (24 hours) and historical analysis.
              </li>
              <li>
                <strong className="text-gray-300">Scan results</strong> — the 0–100 scores and
                detailed findings. Retained indefinitely for aggregate statistics and result sharing.
              </li>
              <li>
                <strong className="text-gray-300">Email address + consent timestamp</strong> —
                collected only if you choose to request the PDF report. Used to deliver the PDF
                and, if you consented, occasional relevant follow-up from Centr8.
              </li>
            </ul>
            <p className="mt-2">
              We do not collect cookies, track you across sites, build behavioural profiles, or
              sell data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              Retention window
            </h2>
            <p>
              Your email address and consent record (the "lead record") are automatically and
              permanently deleted <strong className="text-gray-300">12 months</strong> after the
              date you submitted your email — even if you never request deletion. A scheduled
              nightly job purges all lead records past this window.
            </p>
            <p className="mt-2">
              Scan result data (scores, category breakdowns) is not personal data and is retained
              for longer for aggregate analysis and result-sharing links.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              Your right to deletion
            </h2>
            <p>
              You can request immediate permanent deletion of your data at any time — no account
              required, no questions asked. Two ways:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>
                Click the <strong className="text-gray-300">"Request deletion of your data"</strong>{" "}
                link in the footer of the PDF report or email you received. This uses a signed link
                that deletes only your record.
              </li>
              <li>
                Visit{" "}
                <Link
                  href="/delete"
                  className="text-[#4F7BFF] hover:underline focus:outline-none focus:underline"
                >
                  sitescore.centr8.com/delete
                </Link>{" "}
                and enter your email address. All lead records for that address are permanently deleted.
              </li>
            </ul>
            <p className="mt-2">
              Deletion is hard (permanent) — not a soft flag. We log only the fact and timestamp
              that a deletion occurred, never the data itself.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              Third-party processors
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-gray-300">Resend</strong> — email delivery for PDF reports.
                Your email address is transmitted to Resend to send the report. Resend&apos;s privacy
                policy applies: resend.com/legal/privacy-policy.
              </li>
              <li>
                <strong className="text-gray-300">Hosting infrastructure</strong> — servers are
                operated by Centr8 on cloud infrastructure in the EU/UK.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              Contact
            </h2>
            <p>
              Questions about this policy or your data:{" "}
              <a
                href="mailto:privacy@centr8.com"
                className="text-[#4F7BFF] hover:underline focus:outline-none focus:underline"
              >
                privacy@centr8.com
              </a>
              . We will respond within 72 hours.
            </p>
          </section>

        </div>
      </article>
    </main>
  );
}
