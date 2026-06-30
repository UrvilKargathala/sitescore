/**
 * FR-9 — Branded PDF report using @react-pdf/renderer.
 *
 * Richer than the free on-screen summary:
 * - Extended business-impact paragraphs per category (not just 1 line)
 * - Full fix list (no 8-item cap) with specific action steps per finding
 * - Methodology appendix + monitoring CTA back page
 */
import React from "react";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import path from "path";
import type { ScoredResult, Grade } from "../scoring";
import type { Fix } from "../scoring/top-fixes";

// ── Fonts ─────────────────────────────────────────────────────────────────────

const FONT_DIR_MONTSERRAT = path.join(
  process.cwd(),
  "node_modules/@fontsource/montserrat/files"
);
const FONT_DIR_MANROPE = path.join(
  process.cwd(),
  "node_modules/@fontsource/manrope/files"
);

// Use .woff (not .woff2) — react-pdf's font parser handles woff more reliably
Font.register({
  family: "Montserrat",
  fonts: [
    { src: path.join(FONT_DIR_MONTSERRAT, "montserrat-latin-400-normal.woff") },
    {
      src: path.join(FONT_DIR_MONTSERRAT, "montserrat-latin-700-normal.woff"),
      fontWeight: 700,
    },
  ],
});

Font.register({
  family: "Manrope",
  fonts: [
    { src: path.join(FONT_DIR_MANROPE, "manrope-latin-400-normal.woff") },
    {
      src: path.join(FONT_DIR_MANROPE, "manrope-latin-600-normal.woff"),
      fontWeight: 600,
    },
  ],
});

// ── Brand tokens ─────────────────────────────────────────────────────────────

const BRAND   = "#4F7BFF";
const BG      = "#0a0a0f";
const SURFACE = "#111827";
const BORDER  = "#1f2937";
const TEXT    = "#f9fafb";
const MUTED   = "#6b7280";
const FAINT   = "#374151";

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

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page:        { backgroundColor: BG, paddingHorizontal: 40, paddingVertical: 36, fontFamily: "Manrope", fontSize: 10, color: TEXT },
  coverPage:   { backgroundColor: BG, padding: 0 },

  // Layout
  row:         { flexDirection: "row", alignItems: "center" },
  spacer:      { flex: 1 },
  mb2:         { marginBottom: 2 },
  mb4:         { marginBottom: 4 },
  mb8:         { marginBottom: 8 },
  mb12:        { marginBottom: 12 },
  mb20:        { marginBottom: 20 },
  mb28:        { marginBottom: 28 },

  // Cover
  coverTop:    { backgroundColor: BRAND, paddingHorizontal: 40, paddingTop: 48, paddingBottom: 40 },
  coverLogoText:{ fontFamily: "Montserrat", fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: 0.5 },
  coverTagline:{ fontFamily: "Manrope", fontSize: 10, color: "rgba(255,255,255,0.75)", marginTop: 4 },
  coverBody:   { paddingHorizontal: 40, paddingTop: 36, paddingBottom: 36 },
  coverLabel:  { fontFamily: "Manrope", fontSize: 9, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  coverUrl:    { fontFamily: "Montserrat", fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 24, flexWrap: "wrap" },
  coverScore:  { fontFamily: "Montserrat", fontSize: 64, fontWeight: 700, lineHeight: 1, marginBottom: 2 },
  coverGrade:  { fontFamily: "Montserrat", fontSize: 16, fontWeight: 700, marginBottom: 4 },
  coverSub:    { fontFamily: "Manrope", fontSize: 10, color: MUTED, marginBottom: 24 },
  coverDate:   { fontFamily: "Manrope", fontSize: 9, color: MUTED, marginTop: 6 },
  divider:     { height: 1, backgroundColor: BORDER, marginVertical: 20 },
  thinDivider: { height: 1, backgroundColor: FAINT, marginVertical: 12 },

  // Sections
  sectionTitle:{ fontFamily: "Montserrat", fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 12 },
  subTitle:    { fontFamily: "Montserrat", fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 6 },

  // Category cards (grid row)
  catGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  catCard:     { width: "30%", backgroundColor: SURFACE, borderRadius: 6, padding: 10, borderWidth: 1, borderColor: BORDER },
  catIcon:     { fontFamily: "Manrope", fontSize: 8, color: MUTED, marginBottom: 4 },
  catScore:    { fontFamily: "Montserrat", fontSize: 22, fontWeight: 700, marginBottom: 2 },
  catGrade:    { fontFamily: "Manrope", fontSize: 8, fontWeight: 600, marginBottom: 4 },
  catSummary:  { fontFamily: "Manrope", fontSize: 8, color: MUTED, lineHeight: 1.4 },

  // Fix items
  fixItem:     { backgroundColor: SURFACE, borderRadius: 6, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: BORDER },
  fixHeader:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 6, gap: 6 },
  fixNumber:   { fontFamily: "Montserrat", fontSize: 8, fontWeight: 700, color: BRAND, width: 16, paddingTop: 1 },
  fixTitle:    { fontFamily: "Montserrat", fontSize: 10, fontWeight: 700, color: TEXT, flex: 1, lineHeight: 1.3 },
  fixDetail:   { fontFamily: "Manrope", fontSize: 8.5, color: "#9ca3af", lineHeight: 1.5, marginBottom: 6, marginLeft: 22 },
  fixAction:   { fontFamily: "Manrope", fontSize: 8.5, color: "#d1d5db", lineHeight: 1.5, marginBottom: 6, marginLeft: 22 },
  fixActionLabel: { fontFamily: "Montserrat", fontSize: 8, fontWeight: 700, color: BRAND },
  fixMeta:     { flexDirection: "row", gap: 8, marginLeft: 22 },
  fixImpactHigh:  { fontFamily: "Manrope", fontSize: 8, color: "#f87171", backgroundColor: "rgba(239,68,68,0.12)", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  fixImpactMed:   { fontFamily: "Manrope", fontSize: 8, color: "#fbbf24", backgroundColor: "rgba(245,158,11,0.12)", borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  fixImpactLow:   { fontFamily: "Manrope", fontSize: 8, color: MUTED, backgroundColor: FAINT, borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  fixEffort:   { fontFamily: "Manrope", fontSize: 8, color: MUTED },
  fixPillar:   { fontFamily: "Manrope", fontSize: 8, color: BRAND },

  // Category detail blocks
  catDetailCard: { backgroundColor: SURFACE, borderRadius: 6, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  catDetailScore: { fontFamily: "Montserrat", fontSize: 28, fontWeight: 700, marginBottom: 2 },
  catDetailGrade: { fontFamily: "Manrope", fontSize: 9, fontWeight: 600, marginBottom: 8 },
  catDetailBody:  { fontFamily: "Manrope", fontSize: 9, color: "#d1d5db", lineHeight: 1.6 },

  // Note / disclaimer
  noteBox:     { backgroundColor: "rgba(79,123,255,0.07)", borderRadius: 6, padding: 10, borderWidth: 1, borderColor: "rgba(79,123,255,0.2)", marginBottom: 12 },
  noteText:    { fontFamily: "Manrope", fontSize: 8.5, color: "#93c5fd", lineHeight: 1.5 },

  // CTA page
  ctaPage:     { backgroundColor: BRAND, padding: 40 },
  ctaHeading:  { fontFamily: "Montserrat", fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 12 },
  ctaBody:     { fontFamily: "Manrope", fontSize: 10, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 20 },
  ctaBullet:   { fontFamily: "Manrope", fontSize: 10, color: "rgba(255,255,255,0.85)", marginBottom: 6 },
  ctaUrl:      { fontFamily: "Montserrat", fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 4 },
  ctaMuted:    { fontFamily: "Manrope", fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 8 },

  footer:      { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", alignItems: "center" },
  footerText:  { fontFamily: "Manrope", fontSize: 8, color: MUTED },
  footerPage:  { fontFamily: "Manrope", fontSize: 8, color: MUTED, marginLeft: "auto" },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const IMPACT_ACTIONS: Record<string, string> = {
  "sec-no-https":          "Set up an SSL certificate (Let's Encrypt is free) and configure your web server to serve all traffic over HTTPS.",
  "sec-no-http-redirect":  "Add a permanent 301 redirect in your web server config (Apache/Nginx) or CDN to send all HTTP traffic to HTTPS.",
  "sec-tls-expired":       "Renew the TLS certificate immediately. If using Let's Encrypt, set up auto-renewal via certbot to prevent future expiry.",
  "sec-tls-self-signed":   "Replace the self-signed certificate with one issued by a trusted CA. Let's Encrypt provides free, automatically-renewing certificates.",
  "sec-tls-invalid":       "Contact your certificate authority or hosting provider. Verify the certificate chain is complete and correctly installed.",
  "sec-no-hsts":           "Add the header: Strict-Transport-Security: max-age=31536000; includeSubDomains — in your web server or CDN configuration.",
  "sec-no-csp":            "Define a Content Security Policy. Start with a report-only policy (Content-Security-Policy-Report-Only) to identify required sources before enforcing.",
  "sec-no-xframe":         "Add the header: X-Frame-Options: DENY (or SAMEORIGIN if you embed your own content in iframes).",
  "sec-no-xcto":           "Add the header: X-Content-Type-Options: nosniff — a single line in your server or CDN configuration.",
  "sec-no-referrer":       "Add: Referrer-Policy: strict-origin-when-cross-origin — balances privacy with analytics compatibility.",
  "sec-server-banner":     "In Nginx: server_tokens off; In Apache: ServerTokens Prod; In Express: app.disable('x-powered-by');",
  "sec-xpoweredby":        "In Express: app.disable('x-powered-by'); In PHP: add expose_php = Off to php.ini.",
  "perf-render-blocking-resources": "Audit <head> scripts: defer non-critical JS, inline critical CSS, or preload key resources.",
  "perf-unused-javascript":"Use code splitting (dynamic import()) and tree-shaking. Analyse your bundle with webpack-bundle-analyzer or Rollup Visualizer.",
  "perf-unused-css-rules": "Use PurgeCSS or Tailwind's built-in purge to remove unused class selectors from your production stylesheet.",
  "perf-uses-optimized-images": "Convert images to WebP/AVIF using tools like Squoosh, Sharp, or a CDN with image transformation. Enable Next.js's built-in <Image> component.",
  "perf-uses-responsive-images": "Use <img srcset> or Next.js's <Image> component to serve correctly-sized images per viewport.",
  "perf-uses-text-compression": "Enable gzip or brotli compression in your web server (nginx: gzip on; gzip_types text/plain text/css application/json application/javascript;).",
  "perf-uses-long-cache-ttl": "Add Cache-Control: public, max-age=31536000, immutable headers to all versioned static assets (JS, CSS, images).",
  "perf-total-blocking-time": "Break up long tasks with setTimeout/scheduler.postTask. Defer non-essential third-party scripts. Profile with Chrome DevTools Performance tab.",
  "perf-largest-contentful-paint": "Preload the LCP image (<link rel='preload' as='image'>), ensure it is served from a CDN, and remove any render-blocking resources above it.",
  "perf-cumulative-layout-shift": "Reserve explicit width/height on all images and iframes. Avoid inserting content above existing content. Use CSS min-height for dynamic containers.",
  "perf-server-response-time": "Enable server-side caching (Redis/Varnish), move to a region closer to your users, or add a CDN in front of your origin.",
  "seo-document-title":    "Add a unique <title> tag to every page. Aim for 50–60 characters and include the primary keyword near the beginning.",
  "seo-meta-description":  "Add <meta name='description' content='...'> with 120–160 characters summarising the page's value for searchers.",
  "seo-link-text":         "Replace 'click here' and 'read more' with descriptive text that makes sense out of context, e.g. 'View our accessibility services'.",
  "seo-crawlable-anchors": "Ensure links use real href attributes with a URL, not javascript: or empty (#) values. Use <button> for actions, <a> for navigation.",
  "seo-is-crawlable":      "Remove noindex from <meta robots> or the X-Robots-Tag header if you want this page indexed. Check robots.txt for unintended Disallow rules.",
  "seo-canonical":         "Add <link rel='canonical' href='https://yourdomain.com/page/'> in the <head> to consolidate ranking signals.",
  "seo-structured-data":   "Add JSON-LD schema markup (Organization, WebSite, BreadcrumbList) to help Google display rich results.",
  "seo-image-alt":         "Add alt attributes to all <img> tags describing the image content. Decorative images should have alt=''.",
  "mobile-viewport":       "Add <meta name='viewport' content='width=device-width, initial-scale=1'> inside <head>.",
  "mobile-tap-targets":    "Ensure all tappable elements are at least 48×48 CSS pixels with 8px of space between them. Use padding, not just font size.",
  "mobile-content-width":  "Avoid fixed pixel widths in CSS. Use max-width, flexbox, or CSS Grid. Test with Chrome DevTools device emulation.",
};

const CATEGORY_BUSINESS_IMPACT: Record<string, Record<Grade, string>> = {
  performance: {
    green: "Your site loads quickly for both desktop and mobile users, reducing bounce rates and improving conversion. Fast pages also receive a ranking boost from Google's Core Web Vitals signal.",
    amber: "Slow load times are costing you visitors. Studies show 53% of mobile users abandon a site that takes more than 3 seconds to load. Every second of delay reduces conversions by approximately 7%.",
    red:   "Critical performance issues are significantly impacting user experience and revenue. Google Core Web Vitals failures actively suppress your search rankings, compounding the damage beyond the direct user experience impact.",
  },
  seo: {
    green: "Strong technical SEO foundations are in place. Search engines can effectively crawl, index, and understand your content — setting you up for organic traffic growth.",
    amber: "Several SEO gaps are limiting how well search engines can find and rank your content. Addressing these will improve organic visibility without requiring any content changes.",
    red:   "Critical SEO issues are actively suppressing your search rankings. Some pages may not be indexed at all, meaning potential customers searching for your services cannot find you.",
  },
  security: {
    green: "Your site implements key security headers and serves content over properly configured HTTPS, protecting users and demonstrating trustworthiness to browsers.",
    amber: "Missing security headers leave your site and users exposed to preventable attacks. Modern browsers may flag your site, and customers who notice security warnings lose trust in your brand.",
    red:   "Critical security vulnerabilities put your users at risk and expose your brand to reputational and legal liability. GDPR and similar regulations require appropriate technical security measures.",
  },
  accessibility: {
    green: "Your site is reasonably accessible to users of assistive technology — covering a significant portion of the population with disabilities.",
    amber: "Accessibility barriers are excluding some users with disabilities from your content. Beyond ethical obligations, accessibility compliance is increasingly required by law (EAA 2025, ADA, AODA).",
    red:   "Significant accessibility failures are preventing many users from accessing your content. This creates legal risk under the European Accessibility Act (effective 2025) and similar legislation globally.",
  },
  mobile: {
    green: "Excellent mobile experience across performance and responsiveness — capturing the 60%+ of web traffic that now comes from mobile devices.",
    amber: "Mobile friction is costing you visitors and conversions. With over 60% of traffic coming from mobile devices, poor mobile experience directly affects revenue.",
    red:   "Poor mobile experience is a critical issue. Google uses mobile-first indexing, meaning your desktop performance is largely irrelevant to rankings. Mobile users will bounce immediately.",
  },
};

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  performance:   { icon: "⚡", label: "Performance" },
  seo:           { icon: "🔍", label: "SEO" },
  security:      { icon: "🔒", label: "Security" },
  accessibility: { icon: "♿", label: "Accessibility" },
  mobile:        { icon: "📱", label: "Mobile" },
};

const IMPACT_LABEL: Record<Fix["impact"], string>  = { high: "High impact",   medium: "Medium impact", low: "Low impact"  };
const EFFORT_LABEL: Record<Fix["effort"], string>  = { quick: "Quick fix",    moderate: "Some work",  involved: "Involved" };

// ── Sub-components ────────────────────────────────────────────────────────────

function PageFooter({ url, label }: { url: string; label: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>SiteScore by Centr8 · {url}</Text>
      <Text style={s.footerPage} render={({ pageNumber, totalPages }) =>
        `${label}  |  Page ${pageNumber} of ${totalPages}`
      } />
    </View>
  );
}

function FixItem({ fix, index }: { fix: Fix; index: number }) {
  const impactStyle =
    fix.impact === "high" ? s.fixImpactHigh :
    fix.impact === "medium" ? s.fixImpactMed :
    s.fixImpactLow;

  const action = IMPACT_ACTIONS[fix.id];

  return (
    <View style={s.fixItem} wrap={false}>
      <View style={s.fixHeader}>
        <Text style={s.fixNumber}>{index + 1}.</Text>
        <Text style={s.fixTitle}>{fix.title}</Text>
      </View>

      <Text style={s.fixDetail}>{fix.detail}</Text>

      {action && (
        <View style={{ marginLeft: 22, marginBottom: 6 }}>
          <Text style={s.fixAction}>
            <Text style={s.fixActionLabel}>How to fix: </Text>
            {action}
          </Text>
        </View>
      )}

      <View style={s.fixMeta}>
        <Text style={impactStyle}>{IMPACT_LABEL[fix.impact]}</Text>
        <Text style={s.fixEffort}>{EFFORT_LABEL[fix.effort]}</Text>
        <Text style={{ ...s.fixPillar, marginLeft: "auto" }}>{fix.servicePillar} →</Text>
      </View>
    </View>
  );
}

// ── Document ──────────────────────────────────────────────────────────────────

export interface ReportData {
  url:      string;
  result:   ScoredResult;
  fixes:    Fix[];
  scanDate: string;
}

export function SiteScoreReport({ url, result, fixes, scanDate }: ReportData) {
  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  const categories: Array<keyof typeof CATEGORY_META> = [
    "performance", "seo", "security", "accessibility", "mobile",
  ];

  return (
    <Document
      title={`SiteScore Report — ${hostname}`}
      author="Centr8"
      subject="Website Health Report"
      keywords="sitescore,performance,seo,security,accessibility,mobile"
    >
      {/* ── Page 1: Cover ──────────────────────────────────────────────────── */}
      <Page size="A4" style={s.coverPage}>
        {/* Brand header strip */}
        <View style={s.coverTop}>
          <Text style={s.coverLogoText}>SiteScore</Text>
          <Text style={s.coverTagline}>by Centr8 — Website Health Platform</Text>
        </View>

        <View style={s.coverBody}>
          <Text style={s.coverLabel}>Website Health Report</Text>
          <Text style={s.coverUrl}>{url}</Text>

          <Text
            style={{ ...s.coverScore, color: GRADE_COLOR[result.overall.grade] }}
          >
            {result.overall.score}
          </Text>
          <Text style={s.coverGrade}>
            <Text style={{ color: GRADE_COLOR[result.overall.grade] }}>
              {GRADE_LABEL[result.overall.grade]}
            </Text>
            <Text style={{ color: MUTED, fontFamily: "Manrope", fontSize: 14, fontWeight: 400 }}>
              {" / 100 Overall"}
            </Text>
          </Text>
          <Text style={s.coverSub}>
            Rubric {result.rubricVersion} · Automated scan across 5 categories
          </Text>

          <View style={s.divider} />

          {/* Mini category grid on cover */}
          <View style={s.catGrid}>
            {categories.map((cat) => {
              const cs   = result[cat] as { score: number; grade: Grade };
              const meta = CATEGORY_META[cat];
              return (
                <View key={cat} style={s.catCard}>
                  <Text style={s.catIcon}>{meta.icon}  {meta.label}</Text>
                  <Text style={{ ...s.catScore, color: GRADE_COLOR[cs.grade] }}>{cs.score}</Text>
                  <Text style={{ ...s.catGrade, color: GRADE_COLOR[cs.grade] }}>
                    {GRADE_LABEL[cs.grade]}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={s.coverDate}>Scanned {scanDate}</Text>
        </View>
      </Page>

      {/* ── Page 2: Category Detail ─────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Category Analysis</Text>

        {categories.map((cat) => {
          const cs   = result[cat] as { score: number; grade: Grade };
          const meta = CATEGORY_META[cat];
          const isA11y = cat === "accessibility";

          return (
            <View key={cat} style={s.catDetailCard} wrap={false}>
              <View style={s.row}>
                <View>
                  <Text style={s.catIcon}>{meta.icon}  {meta.label}</Text>
                  <Text style={{ ...s.catDetailScore, color: GRADE_COLOR[cs.grade] }}>
                    {cs.score}
                    <Text style={{ fontSize: 12, color: MUTED }}> / 100</Text>
                  </Text>
                  <Text style={{ ...s.catDetailGrade, color: GRADE_COLOR[cs.grade] }}>
                    {GRADE_LABEL[cs.grade]}
                  </Text>
                </View>
              </View>
              <Text style={s.catDetailBody}>
                {CATEGORY_BUSINESS_IMPACT[cat]?.[cs.grade]}
              </Text>
              {isA11y && (
                <View style={{ ...s.noteBox, marginTop: 8, marginBottom: 0 }}>
                  <Text style={s.noteText}>
                    ⓘ  This score is based on an automated accessibility scan. axe-core detects
                    approximately 30–40% of real accessibility issues. These results are a starting
                    point for investigation and are not a certified WCAG audit.
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        <PageFooter url={hostname} label="Category Analysis" />
      </Page>

      {/* ── Pages 3+: Full Fix List ──────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>
          Prioritised Fix Roadmap — {fixes.length} issue{fixes.length !== 1 ? "s" : ""} found
        </Text>
        <Text style={{ ...s.catDetailBody, marginBottom: 16 }}>
          Issues are ranked by impact × effort. Start from the top — quick, high-impact wins
          first, followed by more involved improvements that will still yield significant returns.
        </Text>

        {fixes.map((fix, i) => (
          <FixItem key={fix.id} fix={fix} index={i} />
        ))}

        <PageFooter url={hostname} label="Fix Roadmap" />
      </Page>

      {/* ── Methodology appendix ────────────────────────────────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>Methodology</Text>

        <View style={s.noteBox}>
          <Text style={s.noteText}>
            This report was produced by SiteScore, an automated website health platform
            by Centr8. Scores are computed from three independent data sources: Google Lighthouse
            (performance, SEO, accessibility, and best practices), axe-core (accessibility rule
            engine covering WCAG 2.0 AA and 2.1 AA criteria), and a custom HTTP/TLS security
            probe. Rubric version: {result.rubricVersion}.
          </Text>
        </View>

        <Text style={{ ...s.subTitle, marginTop: 8 }}>How scores are calculated</Text>
        <View style={{ ...s.catDetailCard, marginBottom: 8 }}>
          <Text style={s.catDetailBody}>
            {"Overall score = weighted average of five category scores:\n" +
             "  • Performance — 25%  (avg. desktop + mobile Lighthouse perf score)\n" +
             "  • Security    — 25%  (deduction-based: HTTPS, TLS, security headers)\n" +
             "  • SEO         — 20%  (Lighthouse SEO score on desktop pass)\n" +
             "  • Accessibility — 15% (60% Lighthouse a11y + 40% axe-core violations)\n" +
             "  • Mobile      — 15%  (60% mobile LH perf + 40% viewport/tap-target audits)\n\n" +
             "Grade bands:  90–100 = Good (green)  ·  50–89 = Needs Work (amber)  ·  0–49 = Critical (red)"}
          </Text>
        </View>

        <Text style={{ ...s.subTitle, marginTop: 8 }}>Limitations</Text>
        <View style={s.catDetailCard}>
          <Text style={s.catDetailBody}>
            {"This report reflects a single automated scan of the root page of the provided URL " +
             "and does not cover:\n" +
             "  • Interior pages, login-gated content, or single-page app sub-routes\n" +
             "  • Manual testing, screen reader walk-throughs, or keyboard-navigation audits\n" +
             "  • Penetration testing, OWASP vulnerability scanning, or dependency audits\n" +
             "  • Third-party scripts, CDN configurations, or backend infrastructure\n\n" +
             "Automated accessibility scanning covers approximately 30–40% of real WCAG issues.\n" +
             "A green accessibility score does not mean your site is WCAG AA compliant.\n" +
             "A certified accessibility audit requires human expert evaluation."}
          </Text>
        </View>

        <PageFooter url={hostname} label="Methodology" />
      </Page>

      {/* ── Back page: CTA ──────────────────────────────────────────────────── */}
      <Page size="A4" style={s.ctaPage}>
        <Text style={{ ...s.coverLogoText, marginBottom: 32 }}>Centr8</Text>

        <Text style={s.ctaHeading}>
          Ready to fix these issues?
        </Text>
        <Text style={s.ctaBody}>
          Centr8 is a full-service digital agency. Our experts can implement
          every fix in this report — from security header configuration and
          performance optimisation to full WCAG AA accessibility remediation.
        </Text>

        <Text style={{ ...s.subTitle, color: "#fff", marginBottom: 10 }}>
          What our clients get:
        </Text>
        {[
          "Web & Mobile Development — performance, accessibility, responsive design",
          "Cloud & DevOps — HTTPS, compression, caching, CDN, server hardening",
          "Security & Compliance — security headers, TLS, GDPR/DPDP readiness",
          "Digital Marketing — SEO, structured data, meta optimisation, schema markup",
          "Maintenance & Support — ongoing monitoring, certificate renewal, updates",
        ].map((item, i) => (
          <Text key={i} style={s.ctaBullet}>{"·  "}{item}</Text>
        ))}

        <View style={{ ...s.divider, borderColor: "rgba(255,255,255,0.2)", marginTop: 24 }} />

        <Text style={{ ...s.subTitle, color: "#fff", marginBottom: 8, marginTop: 16 }}>
          🚀  Coming soon: Continuous Monitoring
        </Text>
        <Text style={s.ctaBody}>
          SiteScore will soon offer automated weekly re-scans with regression alerts —
          so you know the moment a deployment breaks your performance, security, or
          accessibility scores. Join the early access list when you book a consultation.
        </Text>

        <Text style={s.ctaUrl}>centr8.com/contact</Text>
        <Text style={s.ctaMuted}>
          This report was generated by SiteScore ({result.rubricVersion}) on {scanDate}.
          Scores reflect a single automated scan and should be used as a guide, not a
          definitive audit.
        </Text>
      </Page>
    </Document>
  );
}
