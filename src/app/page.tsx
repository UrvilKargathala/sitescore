import type { Metadata } from "next";
import Link from "next/link";
import HomeClient from "./HomeClient";

// ── SEO metadata ──────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "SiteScore — Free Website Health Check in 30 Seconds",
  description:
    "Paste any URL and get a brutally honest 0–100 health report across Performance, SEO, Security, Accessibility, and Mobile — free, no account needed.",
  openGraph: {
    title: "SiteScore — Free Website Health Check",
    description:
      "Get a 0–100 score across Performance, SEO, Security, Accessibility, and Mobile in under 30 seconds. Free, no account needed.",
    url: "https://sitescore.centr8.com",
    siteName: "SiteScore",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SiteScore — Free Website Health Check",
    description:
      "Get a 0–100 score across Performance, SEO, Security, Accessibility, and Mobile in under 30 seconds.",
  },
};

// ── JSON-LD schema ────────────────────────────────────────────────────────────

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SiteScore",
  url: "https://sitescore.centr8.com",
  description:
    "Free automated website health checker. Scan any public URL and get a 0–100 score across Performance, SEO, Security, Accessibility, and Mobile in under 30 seconds.",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  creator: {
    "@type": "Organization",
    name: "Centr8",
    url: "https://centr8.com",
  },
};

// ── Category data ─────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    icon: "⚡",
    name: "Performance",
    weight: "25%",
    description:
      "Page load speed, Core Web Vitals, and rendering efficiency — powered by Google Lighthouse.",
  },
  {
    icon: "🔒",
    name: "Security",
    weight: "25%",
    description:
      "HTTPS enforcement, HSTS, Content Security Policy, and other protective HTTP headers.",
  },
  {
    icon: "🔍",
    name: "SEO",
    weight: "20%",
    description:
      "Title tags, meta descriptions, crawlability, and structured markup — the basics search engines need.",
  },
  {
    icon: "♿",
    name: "Accessibility",
    weight: "15%",
    description:
      "Automated WCAG checks via Lighthouse + axe-core. Catches ~30–40% of real issues.",
  },
  {
    icon: "📱",
    name: "Mobile",
    weight: "15%",
    description:
      "Viewport configuration, tap target sizing, and mobile rendering on a simulated device.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Above-the-fold hero + scan form ── */}
      <HomeClient />

      {/* ── Below-the-fold content (server-rendered, no JS needed) ── */}
      <div className="w-full max-w-2xl mx-auto px-4 pb-24 space-y-20">

        {/* Five categories */}
        <section aria-labelledby="categories-heading">
          <h2
            id="categories-heading"
            className="text-2xl font-bold text-white text-center mb-2"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            Five dimensions of website health
          </h2>
          <p
            className="text-sm text-gray-500 text-center mb-8"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Each category is scored 0–100. The overall score is a weighted average.{" "}
            <Link
              href="/methodology"
              className="text-[#4F7BFF] hover:underline focus:outline-none focus:underline"
            >
              See how we calculate it →
            </Link>
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.name}
                className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 flex gap-3"
              >
                <span className="text-xl shrink-0 mt-0.5" aria-hidden="true">{cat.icon}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-sm font-semibold text-white"
                      style={{ fontFamily: "var(--font-montserrat)" }}
                    >
                      {cat.name}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(79,123,255,0.12)",
                        color: "#4F7BFF",
                        fontFamily: "var(--font-manrope)",
                      }}
                    >
                      {cat.weight}
                    </span>
                  </div>
                  <p
                    className="text-xs text-gray-500 leading-relaxed"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    {cat.description}
                  </p>
                </div>
              </div>
            ))}

            {/* Methodology link card */}
            <Link
              href="/methodology"
              className="rounded-xl border border-dashed border-gray-800 p-4 flex items-center justify-center gap-2
                         text-xs text-gray-600 hover:text-gray-400 hover:border-gray-700 transition-colors
                         focus:outline-none focus:ring-2 focus:ring-[#4F7BFF]/40"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              How we score — methodology &amp; weights
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how-heading">
          <h2
            id="how-heading"
            className="text-2xl font-bold text-white text-center mb-8"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            How it works
          </h2>
          <ol className="space-y-4">
            {[
              {
                n: "1",
                title: "Paste your URL",
                body: "Enter any public web address. SiteScore validates and normalises it before scanning.",
              },
              {
                n: "2",
                title: "We scan in the background",
                body: "A headless Chrome session runs Lighthouse (performance, SEO, accessibility) alongside custom security header and TLS checks — all read-only.",
              },
              {
                n: "3",
                title: "Get your report",
                body: "A scored summary loads instantly. Enter your email for the full branded PDF with a prioritised fix roadmap — no account required.",
              },
            ].map((step) => (
              <li key={step.n} className="flex gap-4">
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "#4F7BFF", fontFamily: "var(--font-montserrat)" }}
                  aria-hidden="true"
                >
                  {step.n}
                </div>
                <div>
                  <p
                    className="text-sm font-semibold text-white mb-0.5"
                    style={{ fontFamily: "var(--font-montserrat)" }}
                  >
                    {step.title}
                  </p>
                  <p
                    className="text-xs text-gray-500 leading-relaxed"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Footer links */}
        <footer
          className="border-t border-gray-800 pt-8 flex flex-wrap justify-between items-center gap-4 text-xs text-gray-600"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          <span>
            Powered by{" "}
            <a
              href="https://centr8.com"
              className="hover:text-gray-400 transition-colors focus:outline-none focus:text-gray-400"
            >
              Centr8
            </a>
          </span>
          <nav className="flex flex-wrap gap-4" aria-label="Footer">
            <Link href="/methodology" className="hover:text-gray-400 transition-colors focus:outline-none focus:text-gray-400">
              Methodology
            </Link>
            <Link href="/scanning-policy" className="hover:text-gray-400 transition-colors focus:outline-none focus:text-gray-400">
              Scanning policy
            </Link>
            <Link href="/privacy" className="hover:text-gray-400 transition-colors focus:outline-none focus:text-gray-400">
              Privacy
            </Link>
            <Link href="/delete" className="hover:text-gray-400 transition-colors focus:outline-none focus:text-gray-400">
              Delete my data
            </Link>
            <a
              href="https://centr8.com/contact"
              className="hover:text-gray-400 transition-colors focus:outline-none focus:text-gray-400"
            >
              Contact
            </a>
          </nav>
        </footer>

      </div>
    </>
  );
}
