import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How We Score — SiteScore Methodology",
  description:
    "Exactly how SiteScore computes its 0–100 website health score: the five categories, their weights, the tools behind each check, and the limitations you should know about.",
  openGraph: {
    title: "SiteScore Scoring Methodology",
    description:
      "How SiteScore's 0–100 score is computed across Performance, SEO, Security, Accessibility, and Mobile — honest, technical, no marketing fluff.",
    url: "https://sitescore.centr8.com/methodology",
    siteName: "SiteScore",
    type: "article",
  },
};

export default function MethodologyPage() {
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
          How We Score
        </h1>
        <p className="text-sm text-gray-500 mb-2" style={{ fontFamily: "var(--font-manrope)" }}>
          Scoring rubric v1 · Last updated June 2026
        </p>
        <p className="text-sm text-gray-400 mb-10 leading-relaxed" style={{ fontFamily: "var(--font-manrope)" }}>
          SiteScore produces a single 0–100 health score by combining five category
          sub-scores via a weighted average. Below is exactly how each sub-score is derived,
          which tools produce the underlying data, and where the approach has known limits.
        </p>

        {/* Overall formula */}
        <section className="mb-10">
          <h2
            className="text-lg font-bold text-white mb-3"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            Overall score formula
          </h2>
          <div
            className="rounded-xl border border-gray-800 bg-gray-900 p-5 font-mono text-sm text-gray-300 leading-relaxed"
          >
            <p className="text-gray-500 text-xs mb-3">Weighted average (all values 0–100):</p>
            <p>Overall = Performance × 0.25</p>
            <p className="pl-10">+ Security × 0.25</p>
            <p className="pl-10">+ SEO × 0.20</p>
            <p className="pl-10">+ Accessibility × 0.15</p>
            <p className="pl-10">+ Mobile × 0.15</p>
          </div>
          <div className="mt-3 flex gap-3 flex-wrap">
            {[
              { grade: "Green", range: "90–100", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
              { grade: "Amber", range: "50–89",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
              { grade: "Red",   range: "0–49",   color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
            ].map((g) => (
              <span
                key={g.grade}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: g.bg, color: g.color, fontFamily: "var(--font-manrope)" }}
              >
                {g.grade}: {g.range}
              </span>
            ))}
          </div>
        </section>

        <div className="space-y-10 text-sm text-gray-400 leading-7" style={{ fontFamily: "var(--font-manrope)" }}>

          {/* Performance */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg" aria-hidden="true">⚡</span>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: "var(--font-montserrat)" }}>
                Performance <span className="text-[#4F7BFF] font-normal text-sm">· 25%</span>
              </h2>
            </div>
            <p>
              Performance is the average of a desktop Lighthouse run and a mobile Lighthouse run,
              both using Lighthouse&apos;s built-in{" "}
              <strong className="text-gray-300">performance category score</strong> (0–1, scaled to 0–100).
              The desktop run uses standard broadband conditions (10 Mbps, 40 ms RTT, no CPU throttle).
              The mobile run applies a simulated mid-range device with a slower CPU and 3G-like throttling
              to reflect real-world mobile conditions.
            </p>
            <p className="mt-2">
              Lighthouse&apos;s performance score reflects Core Web Vitals (LCP, CLS, INP), Time to
              Interactive, Speed Index, and Total Blocking Time — the same signals Google uses in its
              ranking algorithm.
            </p>
            <p className="mt-2 text-gray-600 text-xs">
              Tool: Google Lighthouse v13 (programmatic). Single-page scan only — other pages on the
              same site may perform differently.
            </p>
          </section>

          {/* Security */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg" aria-hidden="true">🔒</span>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: "var(--font-montserrat)" }}>
                Security <span className="text-[#4F7BFF] font-normal text-sm">· 25%</span>
              </h2>
            </div>
            <p>
              Security starts at 100 and applies deductions for missing or weak protections found by
              a custom HTTP probe. The probe makes a single HTTPS request and inspects response headers
              and TLS metadata.
            </p>
            <div className="mt-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
              <p className="text-xs text-gray-500 mb-2 font-mono">Deductions from 100:</p>
              <ul className="space-y-1 text-xs font-mono text-gray-400">
                <li>HTTPS not served           −40</li>
                <li>HSTS header absent         −10</li>
                <li>Content-Security-Policy absent  −10</li>
                <li>X-Frame-Options absent      −8</li>
                <li>X-Content-Type-Options absent   −7</li>
                <li>Referrer-Policy absent       −5</li>
                <li>TLS certificate invalid      −20</li>
              </ul>
            </div>
            <p className="mt-2 text-gray-600 text-xs">
              Tool: custom Node.js HTTP probe (read-only, single request to the root URL).
              This checks observable security hygiene, not vulnerability exploitation.
              A score of 100 means the checked headers are present — it does not imply
              the site is fully secure.
            </p>
          </section>

          {/* SEO */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg" aria-hidden="true">🔍</span>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: "var(--font-montserrat)" }}>
                SEO <span className="text-[#4F7BFF] font-normal text-sm">· 20%</span>
              </h2>
            </div>
            <p>
              SEO uses the desktop Lighthouse{" "}
              <strong className="text-gray-300">SEO category score</strong> (0–1, scaled to 0–100).
              This covers title tags, meta descriptions, canonical URLs, robots directives,
              crawlability, link text, image alt attributes, and structured data presence.
            </p>
            <p className="mt-2 text-gray-600 text-xs">
              Tool: Google Lighthouse v13 SEO audit. Desktop run used because search engines
              primarily crawl from desktop user-agents. Does not check backlinks, domain authority,
              or keyword rankings — those require continuous monitoring, not a one-shot scan.
            </p>
          </section>

          {/* Accessibility */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg" aria-hidden="true">♿</span>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: "var(--font-montserrat)" }}>
                Accessibility <span className="text-[#4F7BFF] font-normal text-sm">· 15%</span>
              </h2>
            </div>
            <div
              className="rounded-lg border px-4 py-3 mb-3 text-xs"
              style={{
                borderColor: "rgba(245,158,11,0.3)",
                background:  "rgba(245,158,11,0.06)",
                color:       "#d97706",
                fontFamily:  "var(--font-manrope)",
              }}
            >
              <strong>Important:</strong> This is an automated accessibility scan, not a certified
              WCAG audit. Automated tools detect approximately 30–40% of real accessibility issues.
              Human testing — including keyboard navigation, screen reader testing, and cognitive
              load review — is required for meaningful conformance assessment.
            </div>
            <p>
              The accessibility score blends two automated signals:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong className="text-gray-300">60% — Lighthouse accessibility score</strong>:
                checks colour contrast, ARIA usage, form labels, image alt text, and document structure.
              </li>
              <li>
                <strong className="text-gray-300">40% — axe-core violation score</strong>:
                a deduction-based score starting from 100, with −15 per critical violation, −8 per
                serious, −3 per moderate, and −1 per minor. Capped at 0.
              </li>
            </ul>
            <p className="mt-2 text-gray-600 text-xs">
              Tools: Google Lighthouse v13 (accessibility category) + axe-core 4.x injected into
              a headless Chrome session targeting WCAG 2.1 A and AA criteria and best practices.
            </p>
          </section>

          {/* Mobile */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg" aria-hidden="true">📱</span>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: "var(--font-montserrat)" }}>
                Mobile <span className="text-[#4F7BFF] font-normal text-sm">· 15%</span>
              </h2>
            </div>
            <p>
              Mobile blends two signals from the mobile Lighthouse run:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong className="text-gray-300">60% — mobile performance score</strong>:
                Lighthouse performance on a simulated mid-range device with CPU and network throttling.
              </li>
              <li>
                <strong className="text-gray-300">40% — mobile UX audits</strong>:
                average of three specific Lighthouse audits: viewport meta tag presence,
                tap-target sizing, and content-width overflow.
              </li>
            </ul>
            <p className="mt-2 text-gray-600 text-xs">
              Tool: Google Lighthouse v13 (mobile emulation). Simulates a mid-range Android device.
              Does not test on a real device or test native app experiences.
            </p>
          </section>

          {/* Limitations */}
          <section>
            <h2
              className="text-base font-bold text-white mb-2"
              style={{ fontFamily: "var(--font-montserrat)" }}
            >
              Known limitations
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-gray-500 text-sm">
              <li>SiteScore scans only the root URL. Inner pages, blog posts, and checkout flows are not included.</li>
              <li>JavaScript-heavy pages that require interaction to load content may not be fully captured.</li>
              <li>Results reflect a single point in time. CDN caching, A/B tests, and server load can cause variation between scans.</li>
              <li>Security checks are limited to observable HTTP headers — no payload injection or active testing is performed.</li>
              <li>The 24-hour result cache means scanning the same domain multiple times in a day returns the same result.</li>
            </ul>
          </section>

        </div>

        {/* CTA */}
        <div className="mt-12 rounded-xl border border-gray-800 bg-gray-900 p-6 text-center">
          <p
            className="text-white font-semibold mb-2"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            Ready to see your score?
          </p>
          <p className="text-sm text-gray-500 mb-4" style={{ fontFamily: "var(--font-manrope)" }}>
            Free scan, no account needed, results in under 30 seconds.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all
                       hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#4F7BFF]/50"
            style={{ background: "#4F7BFF", fontFamily: "var(--font-montserrat)" }}
          >
            Scan my website →
          </Link>
        </div>

      </article>
    </main>
  );
}
