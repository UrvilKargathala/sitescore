import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { generateFixes } from "@/lib/scoring/top-fixes";
import { EmailGate } from "./EmailGate";
import type { ScoredResult, Grade, Category } from "@/lib/scoring";
import type { Fix, Category as FixCategory } from "@/lib/scoring/top-fixes";

// ── Per-page SEO metadata ─────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ scanId: string }> }
): Promise<Metadata> {
  const { scanId } = await params;
  const scan = await prisma.scan.findUnique({
    where:  { id: scanId },
    select: { url: true, overallScore: true, status: true },
  });

  if (!scan || scan.status !== "COMPLETED") {
    return { title: "Scan Results — SiteScore" };
  }

  let hostname = scan.url;
  try { hostname = new URL(scan.url).hostname; } catch { /* keep raw */ }

  const score = scan.overallScore ?? 0;
  const grade = score >= 90 ? "Good" : score >= 50 ? "Needs Work" : "Critical";
  const ogImage = `/api/og/${scanId}`;

  return {
    title:       `${hostname} scored ${score}/100 — SiteScore`,
    description: `Website health report for ${hostname}: overall score ${score}/100 (${grade}). Performance, SEO, Security, Accessibility, and Mobile breakdown.`,
    openGraph: {
      title:       `${hostname} — ${score}/100 on SiteScore`,
      description: `${grade} · See the full breakdown across Performance, SEO, Security, Accessibility, and Mobile.`,
      url:         `https://sitescore.centr8.com/results/${scanId}`,
      siteName:    "SiteScore",
      type:        "article",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `SiteScore: ${hostname} scored ${score}/100` }],
    },
    twitter: {
      card:        "summary_large_image",
      title:       `${hostname} — ${score}/100 on SiteScore`,
      description: `${grade} · Performance, SEO, Security, Accessibility, Mobile breakdown.`,
      images:      [ogImage],
    },
  };
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getScan(scanId: string) {
  return prisma.scan.findUnique({
    where: { id: scanId },
    select: {
      id: true,
      url: true,
      status: true,
      errorReason: true,
      completedAt: true,
      rulebookVersion: true,
      resultJson:        true,
      lighthouseDesktop: true,
      lighthouseMobile:  true,
      securityJson:      true,
      axeJson:           true,
      lead: { select: { id: true } }, // check if lead already captured
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<Grade, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red:   "#ef4444",
};

const GRADE_LABEL: Record<Grade, string> = {
  green: "Good",
  amber: "Needs Work",
  red:   "Critical",
};

const GRADE_BG: Record<Grade, string> = {
  green: "rgba(34,197,94,0.1)",
  amber: "rgba(245,158,11,0.1)",
  red:   "rgba(239,68,68,0.1)",
};

const GRADE_BORDER: Record<Grade, string> = {
  green: "rgba(34,197,94,0.25)",
  amber: "rgba(245,158,11,0.25)",
  red:   "rgba(239,68,68,0.25)",
};

const CATEGORY_META: Record<
  Category,
  { label: string; icon: string; summary: Record<Grade, string> }
> = {
  performance: {
    label: "Performance",
    icon: "⚡",
    summary: {
      green: "Fast load times across desktop and mobile.",
      amber: "Page speed has room for improvement.",
      red:   "Slow load times are likely costing you visitors.",
    },
  },
  seo: {
    label: "SEO",
    icon: "🔍",
    summary: {
      green: "Strong search-engine visibility signals.",
      amber: "Some SEO issues are limiting discoverability.",
      red:   "Critical SEO problems are likely hurting rankings.",
    },
  },
  security: {
    label: "Security",
    icon: "🔒",
    summary: {
      green: "Security headers and HTTPS are properly configured.",
      amber: "Some security headers are missing or misconfigured.",
      red:   "Critical security vulnerabilities need immediate attention.",
    },
  },
  accessibility: {
    label: "Accessibility",
    icon: "♿",
    summary: {
      green: "Good accessibility for assistive technology users.",
      amber: "Some barriers may exclude users with disabilities.",
      red:   "Significant issues may exclude many users.",
    },
  },
  mobile: {
    label: "Mobile",
    icon: "📱",
    summary: {
      green: "Excellent experience on mobile devices.",
      amber: "Mobile experience has some friction.",
      red:   "Poor mobile experience is likely hurting conversions.",
    },
  },
};

const CATEGORY_ICON: Record<FixCategory, string> = {
  performance:   "⚡",
  seo:           "🔍",
  security:      "🔒",
  accessibility: "♿",
  mobile:        "📱",
};

const IMPACT_LABEL: Record<Fix["impact"], string>  = { high: "High impact",   medium: "Medium impact", low: "Low impact" };
const EFFORT_LABEL: Record<Fix["effort"], string>  = { quick: "Quick fix", moderate: "Some work",   involved: "Involved" };

/** Score ring — pure SVG, no JS required */
function ScoreRing({ score, grade }: { score: number; grade: Grade }) {
  const r = 54;
  const circ = 2 * Math.PI * r; // ≈ 339.3
  const offset = circ * (1 - score / 100);
  const color = GRADE_COLOR[grade];

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: 160, height: 160 }}>
      <svg
        viewBox="0 0 120 120"
        width="160"
        height="160"
        aria-hidden="true"
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Track */}
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
        {/* Score arc */}
        <circle
          cx="60" cy="60" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      {/* Number overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-4xl font-bold leading-none"
          style={{ color, fontFamily: "var(--font-montserrat)" }}
        >
          {score}
        </span>
        <span className="text-xs text-gray-500 mt-1" style={{ fontFamily: "var(--font-manrope)" }}>
          / 100
        </span>
      </div>
    </div>
  );
}

/** Small inline score badge for category cards */
function ScoreBadge({ score, grade }: { score: number; grade: Grade }) {
  const color = GRADE_COLOR[grade];
  return (
    <span
      className="text-3xl font-bold leading-none"
      style={{ color, fontFamily: "var(--font-montserrat)" }}
      aria-label={`${score} out of 100`}
    >
      {score}
    </span>
  );
}

/** Thin progress bar that encodes the score as width — visual + non-color signal */
function ScoreBar({ score, grade }: { score: number; grade: Grade }) {
  return (
    <div
      className="h-1 rounded-full mt-2 mb-1"
      style={{ background: "#1f2937" }}
      role="presentation"
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${score}%`, background: GRADE_COLOR[grade] }}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const scan = await getScan(scanId);

  if (!scan) notFound();

  // Scan still in progress — shouldn't normally happen (we redirect on ready)
  if (scan.status === "PENDING" || scan.status === "RUNNING") {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="text-center max-w-md">
          <div className="w-8 h-8 border-2 border-[#4F7BFF] border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
          <p className="text-white font-semibold" style={{ fontFamily: "var(--font-montserrat)" }}>
            Scan in progress…
          </p>
          <p className="text-gray-400 text-sm mt-2" style={{ fontFamily: "var(--font-manrope)" }}>
            This page will update when the scan finishes.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 text-sm hover:underline focus:outline-none focus:underline"
            style={{ color: "#4F7BFF", fontFamily: "var(--font-manrope)" }}
          >
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  // Failed scan
  if (scan.status === "FAILED" || !scan.resultJson) {
    return (
      <main className="flex flex-1 flex-col px-4 py-12 max-w-4xl mx-auto w-full">
        <TopBar />
        <div
          className="rounded-xl border p-6 mt-8"
          style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.07)" }}
        >
          <h1
            className="text-xl font-bold text-red-400 mb-2"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            Scan failed
          </h1>
          <p className="text-gray-400 text-sm break-all" style={{ fontFamily: "var(--font-manrope)" }}>
            {scan.url}
          </p>
          {scan.errorReason && (
            <p className="mt-3 text-gray-300 text-sm" style={{ fontFamily: "var(--font-manrope)" }}>
              {scan.errorReason}
            </p>
          )}
          <Link
            href="/"
            className="inline-block mt-4 text-sm hover:underline focus:outline-none focus:underline"
            style={{ color: "#4F7BFF", fontFamily: "var(--font-manrope)" }}
          >
            ← Try another URL
          </Link>
        </div>
      </main>
    );
  }

  const result = scan.resultJson as unknown as ScoredResult;
  const fixes  = generateFixes({
    lighthouseDesktop: scan.lighthouseDesktop,
    lighthouseMobile:  scan.lighthouseMobile,
    securityJson:      scan.securityJson,
    axeJson:           scan.axeJson,
  });

  const hostname = (() => {
    try { return new URL(scan.url).hostname; } catch { return scan.url; }
  })();

  const scanDate = scan.completedAt
    ? new Date(scan.completedAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : null;

  const categories: Category[] = ["performance", "seo", "security", "accessibility", "mobile"];
  const a11yFixes = fixes.filter((f) => f.category === "accessibility");
  const hasA11yFixes = a11yFixes.length > 0;

  return (
    <main className="flex flex-1 flex-col px-4 py-10 max-w-4xl mx-auto w-full">
      <TopBar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section aria-labelledby="hero-heading" className="mt-10 text-center">
        <p
          className="text-sm text-gray-500 mb-1 break-all"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          {scan.url}
        </p>
        <h1
          id="hero-heading"
          className="text-3xl sm:text-4xl font-bold text-white mb-8"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          Health Report for{" "}
          <span style={{ color: "#4F7BFF" }}>{hostname}</span>
        </h1>

        {/* Score ring */}
        <div className="flex flex-col items-center gap-3">
          <ScoreRing score={result.overall.score} grade={result.overall.grade} />
          <div>
            <span
              className="text-sm font-semibold"
              style={{ color: GRADE_COLOR[result.overall.grade], fontFamily: "var(--font-manrope)" }}
            >
              {GRADE_LABEL[result.overall.grade]}
            </span>
            <span className="text-gray-600 text-sm mx-2">·</span>
            <span className="text-gray-500 text-sm" style={{ fontFamily: "var(--font-manrope)" }}>
              Overall health score
            </span>
          </div>
          {scanDate && (
            <p className="text-xs text-gray-600" style={{ fontFamily: "var(--font-manrope)" }}>
              Scanned {scanDate} · Rubric {result.rubricVersion}
            </p>
          )}
        </div>
      </section>

      {/* ── Category cards ────────────────────────────────────────────────── */}
      <section aria-labelledby="categories-heading" className="mt-14">
        <h2
          id="categories-heading"
          className="text-lg font-semibold text-white mb-5"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          Category Scores
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => {
            const cs    = result[cat];
            const meta  = CATEGORY_META[cat];
            const isA11y = cat === "accessibility";

            return (
              <article
                key={cat}
                aria-label={`${meta.label}: ${cs.score} out of 100, ${GRADE_LABEL[cs.grade]}`}
                className="rounded-xl border p-5 flex flex-col gap-1"
                style={{
                  background:   GRADE_BG[cs.grade],
                  borderColor:  GRADE_BORDER[cs.grade],
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-sm font-semibold text-gray-200"
                    style={{ fontFamily: "var(--font-montserrat)" }}
                    aria-hidden="true"
                  >
                    {meta.icon} {meta.label}
                  </span>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      color:      GRADE_COLOR[cs.grade],
                      background: GRADE_BG[cs.grade],
                      border:     `1px solid ${GRADE_BORDER[cs.grade]}`,
                      fontFamily: "var(--font-manrope)",
                    }}
                  >
                    {GRADE_LABEL[cs.grade]}
                  </span>
                </div>

                <ScoreBadge score={cs.score} grade={cs.grade} />
                <ScoreBar   score={cs.score} grade={cs.grade} />

                <p
                  className="text-xs text-gray-400 mt-1"
                  style={{ fontFamily: "var(--font-manrope)" }}
                >
                  {meta.summary[cs.grade]}
                </p>

                {/* Accessibility disclaimer inline with the card */}
                {isA11y && (
                  <p
                    className="text-xs mt-2 pt-2 border-t text-gray-500 italic"
                    style={{
                      borderColor:  "rgba(255,255,255,0.07)",
                      fontFamily:   "var(--font-manrope)",
                    }}
                  >
                    ⓘ Automated scan only — not a certified WCAG audit. axe-core detects
                    approximately 30–40% of real accessibility issues.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Top fixes ─────────────────────────────────────────────────────── */}
      {fixes.length > 0 && (
        <section aria-labelledby="fixes-heading" className="mt-14">
          <h2
            id="fixes-heading"
            className="text-lg font-semibold text-white mb-1"
            style={{ fontFamily: "var(--font-montserrat)" }}
          >
            Top Issues to Fix
          </h2>
          <p
            className="text-sm text-gray-500 mb-5"
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            Highest-impact improvements, ranked by effort vs. impact.
          </p>

          {/* Inline reminder before accessibility fixes if any appear in this list */}
          {hasA11yFixes && (
            <div
              className="rounded-lg border px-4 py-3 mb-4 text-sm text-gray-400"
              style={{
                borderColor: "rgba(255,255,255,0.08)",
                background:  "rgba(255,255,255,0.03)",
                fontFamily:  "var(--font-manrope)",
              }}
              role="note"
              aria-label="Accessibility scan disclaimer"
            >
              ⓘ Accessibility findings below come from an automated scan and are not a
              certified WCAG audit. They represent a starting point — a professional
              audit covers issues automated tools cannot detect.
            </div>
          )}

          <ol className="flex flex-col gap-3" aria-label="Top issues to fix">
            {fixes.map((fix, i) => (
              <li
                key={fix.id}
                className="rounded-xl border px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3"
                style={{ borderColor: "#1f2937", background: "#111827" }}
              >
                {/* Number */}
                <span
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "rgba(79,123,255,0.15)", color: "#4F7BFF", fontFamily: "var(--font-montserrat)" }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span aria-hidden="true">{CATEGORY_ICON[fix.category]}</span>
                    <span
                      className="text-sm font-semibold text-white"
                      style={{ fontFamily: "var(--font-montserrat)" }}
                    >
                      {fix.title}
                    </span>
                  </div>
                  <p
                    className="text-xs text-gray-400 mb-2"
                    style={{ fontFamily: "var(--font-manrope)" }}
                  >
                    {fix.detail}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Impact/effort tags */}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: fix.impact === "high"
                          ? "rgba(239,68,68,0.12)"
                          : fix.impact === "medium"
                          ? "rgba(245,158,11,0.12)"
                          : "rgba(107,114,128,0.15)",
                        color: fix.impact === "high" ? "#f87171"
                          : fix.impact === "medium" ? "#fbbf24"
                          : "#9ca3af",
                        fontFamily: "var(--font-manrope)",
                      }}
                    >
                      {IMPACT_LABEL[fix.impact]}
                    </span>
                    <span
                      className="text-xs text-gray-500"
                      style={{ fontFamily: "var(--font-manrope)" }}
                    >
                      ·
                    </span>
                    <span
                      className="text-xs text-gray-400"
                      style={{ fontFamily: "var(--font-manrope)" }}
                    >
                      {EFFORT_LABEL[fix.effort]}
                    </span>

                    {/* Service pillar link */}
                    <a
                      href={fix.serviceUrl}
                      className="ml-auto text-xs font-semibold hover:underline focus:outline-none focus:underline shrink-0"
                      style={{ color: "#4F7BFF", fontFamily: "var(--font-manrope)" }}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Get help with ${fix.title} — ${fix.servicePillar} (opens in new tab)`}
                    >
                      {fix.servicePillar} →
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Email gate — free content above stays fully visible ──────────── */}
      <div className="mt-14">
        <EmailGate scanId={scan.id} alreadySubmitted={!!scan.lead} />
      </div>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section
        aria-labelledby="cta-heading"
        className="mt-14 rounded-xl border px-6 py-8 text-center"
        style={{ borderColor: "rgba(79,123,255,0.2)", background: "rgba(79,123,255,0.06)" }}
      >
        <h2
          id="cta-heading"
          className="text-xl font-bold text-white mb-2"
          style={{ fontFamily: "var(--font-montserrat)" }}
        >
          Want help fixing these issues?
        </h2>
        <p
          className="text-gray-400 text-sm mb-6 max-w-md mx-auto"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Centr8's experts cover everything from performance optimisation and
          SEO to security hardening and accessibility remediation.
        </p>
        <a
          href="https://centr8.com/contact"
          className="inline-block rounded-xl px-6 py-3 font-semibold text-sm text-white transition-all hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#4F7BFF]/50"
          style={{ background: "#4F7BFF", fontFamily: "var(--font-montserrat)" }}
        >
          Talk to an expert
        </a>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer
        className="mt-10 pt-6 border-t text-center text-xs text-gray-600"
        style={{ borderColor: "#1f2937", fontFamily: "var(--font-manrope)" }}
      >
        <p>
          Powered by{" "}
          <a
            href="https://centr8.com"
            className="hover:underline focus:outline-none focus:underline"
            style={{ color: "#4F7BFF" }}
          >
            Centr8
          </a>{" "}
          · Scores computed with rubric {result.rubricVersion} ·{" "}
          Lighthouse + axe-core + custom security probe
        </p>
        <p className="mt-1">
          Results reflect a single automated scan and may not capture every issue.
          For a comprehensive audit, contact us.
        </p>
      </footer>
    </main>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function TopBar() {
  return (
    <nav
      className="flex items-center justify-between"
      aria-label="Page navigation"
    >
      <Link
        href="/"
        className="text-lg font-bold focus:outline-none focus:underline"
        style={{ color: "#4F7BFF", fontFamily: "var(--font-montserrat)" }}
        aria-label="SiteScore — go to home page"
      >
        SiteScore
      </Link>
      <Link
        href="/"
        className="text-sm text-gray-400 hover:text-white transition-colors focus:outline-none focus:underline"
        style={{ fontFamily: "var(--font-manrope)" }}
      >
        ← Scan another URL
      </Link>
    </nav>
  );
}
