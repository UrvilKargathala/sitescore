import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Scanning Policy — SiteScore",
  description: "How SiteScore scans websites responsibly and what it does and does not do.",
};

export default function ScanningPolicyPage() {
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
          Responsible Scanning Policy
        </h1>
        <p className="text-sm text-gray-500 mb-10" style={{ fontFamily: "var(--font-manrope)" }}>
          Last updated: June 2026
        </p>

        <div className="space-y-8 text-gray-400 text-sm leading-7" style={{ fontFamily: "var(--font-manrope)" }}>

          <section>
            <h2 className="text-base font-semibold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              What SiteScore does
            </h2>
            <p>
              SiteScore loads the public root page of a URL you submit and runs automated
              read-only checks across five categories: Performance, SEO, Security headers,
              Accessibility, and Mobile-friendliness. These are the same kinds of checks that
              search engine crawlers and browser developer tools perform routinely.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              What SiteScore does not do
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-gray-300">No exploitation.</strong> We never attempt to exploit vulnerabilities, inject payloads, or probe for weaknesses beyond reading publicly visible HTTP headers and page content.</li>
              <li><strong className="text-gray-300">No aggressive crawling.</strong> Each scan loads a single page — the root URL you provide. We do not spider the site, follow internal links, or crawl multiple paths.</li>
              <li><strong className="text-gray-300">No port scanning.</strong> We do not scan ports beyond the standard HTTPS/HTTP port implied by the URL.</li>
              <li><strong className="text-gray-300">No authenticated areas.</strong> We never attempt to log in, bypass authentication, or access anything that requires credentials.</li>
              <li><strong className="text-gray-300">No data harvesting.</strong> We do not store or share page content. Scan results (scores and metadata) are cached for up to 24 hours for performance, then tied only to the scan record.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              robots.txt compliance
            </h2>
            <p>
              Before scanning any site, SiteScore fetches and checks its{" "}
              <code className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">robots.txt</code>.
              If the site has explicitly disallowed automated scanning of its root path for
              all agents or for &quot;SiteScore&quot; specifically, we will not proceed with the scan
              and will inform you of the restriction.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              Rate limiting
            </h2>
            <p>
              To protect the sites being scanned from unintentional load, we enforce two limits:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Each IP address may submit up to 5 scans per hour.</li>
              <li>The same target domain can be scanned at most once every 10 minutes, regardless of who requests it.</li>
              <li>If a domain was scanned successfully in the last 24 hours, we return the cached result instead of running a new scan.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              Identification
            </h2>
            <p>
              Scan requests are made with the user-agent string{" "}
              <code className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">
                SiteScore/1.0 (automated site health scanner; read-only)
              </code>
              , so site owners can identify and block our scanner in their server logs or{" "}
              <code className="text-xs bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">robots.txt</code>{" "}
              if they choose.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white mb-2" style={{ fontFamily: "var(--font-montserrat)" }}>
              Contact
            </h2>
            <p>
              If you are a site owner and believe SiteScore has scanned your site inappropriately,
              or if you would like your site excluded from future scans, please contact us at{" "}
              <a
                href="mailto:hello@centr8.com"
                className="text-[#4F7BFF] hover:underline focus:outline-none focus:underline"
              >
                hello@centr8.com
              </a>
              . We will respond within 48 hours and will add your domain to our exclusion list upon
              a verified request.
            </p>
          </section>

        </div>
      </article>
    </main>
  );
}
