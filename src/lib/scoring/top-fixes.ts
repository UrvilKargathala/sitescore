/**
 * Top-fixes generator — pure function, no I/O.
 *
 * Given the raw probe blobs stored in Postgres, returns a prioritised list
 * of plain-English fix recommendations with Centr8 service-pillar links.
 * Called by the results page server component; easy to unit-test in isolation.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type Category = "performance" | "security" | "seo" | "accessibility" | "mobile";
export type Impact   = "high" | "medium" | "low";
export type Effort   = "quick" | "moderate" | "involved";

export type ServicePillar =
  | "Web & Mobile Development"
  | "Cloud & DevOps"
  | "Security & Compliance"
  | "Digital Marketing"
  | "Maintenance & Support";

// Centr8 placeholder service URLs — swap for real slugs in FR-9
const PILLAR_URLS: Record<ServicePillar, string> = {
  "Web & Mobile Development": "https://centr8.com/services/web-mobile-development",
  "Cloud & DevOps":           "https://centr8.com/services/cloud-devops",
  "Security & Compliance":    "https://centr8.com/services/security-compliance",
  "Digital Marketing":        "https://centr8.com/services/digital-marketing",
  "Maintenance & Support":    "https://centr8.com/services/maintenance-support",
};

export interface Fix {
  id: string;
  category: Category;
  title: string;
  detail: string;
  impact: Impact;
  effort: Effort;
  servicePillar: ServicePillar;
  serviceUrl: string;
}

// ── Raw probe shapes (minimal — mirrors what's stored in Postgres) ─────────────

interface LhrAudit { score: number | null }
interface LhrSnapshot {
  audits: Record<string, LhrAudit | undefined>;
}

interface SecurityFindings {
  error?: string | null;
  https?: { served?: boolean; httpRedirectsToHttps?: boolean | null };
  tls?: { trusted?: boolean; expired?: boolean; selfSigned?: boolean; error?: string | null };
  headers?: Record<string, { present?: boolean }>;
  versionBanners?: { server?: { exposed?: boolean }; xPoweredBy?: { exposed?: boolean } };
}

interface AxeFindings {
  error?: string | null;
  violations?: Array<{
    id: string;
    impact?: string | null;
    help?: string;
    description?: string;
  }>;
}

export interface RawProbes {
  lighthouseDesktop: unknown;
  lighthouseMobile:  unknown;
  securityJson:      unknown;
  axeJson:           unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function priorityOf(impact: Impact, effort: Effort): number {
  const i = impact  === "high" ? 30 : impact  === "medium" ? 20 : 10;
  const e = effort  === "quick" ? 5  : effort  === "moderate" ? 2  : 0;
  return i + e;
}

function makeFix(
  partial: Omit<Fix, "serviceUrl"> & { servicePillar: ServicePillar }
): Fix & { _priority: number } {
  return {
    ...partial,
    serviceUrl: PILLAR_URLS[partial.servicePillar],
    _priority: priorityOf(partial.impact, partial.effort),
  };
}

function auditFails(snap: LhrSnapshot, id: string): boolean {
  const score = snap.audits[id]?.score;
  return score !== null && score !== undefined && score < 0.9;
}

// ── Security fixes ────────────────────────────────────────────────────────────

function securityFixes(raw: unknown): ReturnType<typeof makeFix>[] {
  const s = (raw ?? {}) as SecurityFindings;
  if (s.error) return [];
  const fixes: ReturnType<typeof makeFix>[] = [];

  if (!s.https?.served) {
    fixes.push(makeFix({
      id: "sec-no-https",
      category: "security",
      title: "Site is not served over HTTPS",
      detail: "All traffic is unencrypted. Browsers mark HTTP sites as 'Not Secure', harming trust and SEO rankings.",
      impact: "high", effort: "involved",
      servicePillar: "Security & Compliance",
    }));
  } else {
    if (s.https.httpRedirectsToHttps === false) {
      fixes.push(makeFix({
        id: "sec-no-http-redirect",
        category: "security",
        title: "HTTP doesn't redirect to HTTPS",
        detail: "Port 80 is reachable but doesn't redirect visitors to the secure version of your site.",
        impact: "medium", effort: "quick",
        servicePillar: "Security & Compliance",
      }));
    }
    if (s.tls && !s.tls.trusted) {
      if (s.tls.expired) {
        fixes.push(makeFix({
          id: "sec-tls-expired",
          category: "security",
          title: "TLS certificate has expired",
          detail: "Browsers will block access to your site and show a scary error page until the certificate is renewed.",
          impact: "high", effort: "quick",
          servicePillar: "Maintenance & Support",
        }));
      } else if (s.tls.selfSigned) {
        fixes.push(makeFix({
          id: "sec-tls-self-signed",
          category: "security",
          title: "TLS certificate is self-signed",
          detail: "Self-signed certificates are not trusted by browsers. Visitors will see a security warning.",
          impact: "high", effort: "quick",
          servicePillar: "Security & Compliance",
        }));
      } else {
        fixes.push(makeFix({
          id: "sec-tls-invalid",
          category: "security",
          title: "TLS certificate validation failed",
          detail: s.tls.error ?? "The site's TLS certificate could not be verified by standard trust chains.",
          impact: "high", effort: "moderate",
          servicePillar: "Security & Compliance",
        }));
      }
    }
  }

  const h = s.headers ?? {};
  if (!h.hsts?.present) {
    fixes.push(makeFix({
      id: "sec-no-hsts",
      category: "security",
      title: "Missing HSTS header",
      detail: "Strict-Transport-Security tells browsers to always use HTTPS, preventing protocol-downgrade attacks.",
      impact: "high", effort: "quick",
      servicePillar: "Security & Compliance",
    }));
  }
  if (!h.csp?.present) {
    fixes.push(makeFix({
      id: "sec-no-csp",
      category: "security",
      title: "No Content Security Policy",
      detail: "A CSP header restricts which scripts and resources the browser can load, reducing XSS risk significantly.",
      impact: "high", effort: "moderate",
      servicePillar: "Security & Compliance",
    }));
  }
  if (!h.xFrameOptions?.present) {
    fixes.push(makeFix({
      id: "sec-no-xframe",
      category: "security",
      title: "No clickjacking protection header",
      detail: "X-Frame-Options prevents your page from being embedded in a frame on another domain (clickjacking attacks).",
      impact: "medium", effort: "quick",
      servicePillar: "Security & Compliance",
    }));
  }
  if (!h.xContentTypeOptions?.present) {
    fixes.push(makeFix({
      id: "sec-no-xcto",
      category: "security",
      title: "Missing X-Content-Type-Options header",
      detail: "Without nosniff, browsers may interpret files as a different MIME type, which can be exploited.",
      impact: "medium", effort: "quick",
      servicePillar: "Security & Compliance",
    }));
  }
  if (!h.referrerPolicy?.present) {
    fixes.push(makeFix({
      id: "sec-no-referrer",
      category: "security",
      title: "No Referrer-Policy header",
      detail: "Without a Referrer-Policy, sensitive URL paths can leak to third parties via the Referer header.",
      impact: "low", effort: "quick",
      servicePillar: "Security & Compliance",
    }));
  }
  if (s.versionBanners?.server?.exposed) {
    fixes.push(makeFix({
      id: "sec-server-banner",
      category: "security",
      title: "Server software version is publicly visible",
      detail: "The Server response header reveals the web server name and version, making targeted attacks easier.",
      impact: "medium", effort: "quick",
      servicePillar: "Security & Compliance",
    }));
  }
  if (s.versionBanners?.xPoweredBy?.exposed) {
    fixes.push(makeFix({
      id: "sec-xpoweredby",
      category: "security",
      title: "X-Powered-By header discloses technology stack",
      detail: "Removing X-Powered-By reduces information leakage about the framework or runtime in use.",
      impact: "low", effort: "quick",
      servicePillar: "Security & Compliance",
    }));
  }

  return fixes;
}

// ── Performance fixes ─────────────────────────────────────────────────────────

const PERF_AUDITS: Array<{
  id: string; title: string; detail: string;
  impact: Impact; effort: Effort; pillar: ServicePillar;
}> = [
  { id: "render-blocking-resources", impact: "high",   effort: "moderate",
    title: "Render-blocking resources delay the first paint",
    detail: "Scripts or stylesheets loaded in <head> block the browser from rendering anything until they finish downloading.",
    pillar: "Web & Mobile Development" },
  { id: "unused-javascript", impact: "high", effort: "moderate",
    title: "Unused JavaScript is loaded on every page",
    detail: "Code that's never executed still has to be downloaded and parsed, wasting bandwidth and CPU time.",
    pillar: "Web & Mobile Development" },
  { id: "unused-css-rules", impact: "medium", effort: "quick",
    title: "Unused CSS rules inflate the stylesheet",
    detail: "Removing dead CSS reduces download size and speeds up the browser's style-calculation step.",
    pillar: "Web & Mobile Development" },
  { id: "uses-optimized-images", impact: "high", effort: "moderate",
    title: "Images are larger than necessary",
    detail: "Re-encoding images with modern formats (WebP/AVIF) and appropriate compression can cut image weight by 30–70%.",
    pillar: "Web & Mobile Development" },
  { id: "uses-responsive-images", impact: "medium", effort: "quick",
    title: "Images aren't sized for the device",
    detail: "Serving oversized images to small screens wastes bandwidth. Use srcset to deliver the right size per viewport.",
    pillar: "Web & Mobile Development" },
  { id: "uses-text-compression", impact: "medium", effort: "quick",
    title: "Text responses aren't compressed",
    detail: "Enabling gzip or brotli compression on HTML, CSS, and JS typically reduces their transfer size by 60–80%.",
    pillar: "Cloud & DevOps" },
  { id: "uses-long-cache-ttl", impact: "medium", effort: "quick",
    title: "Static assets expire too quickly",
    detail: "Short cache lifetimes force repeat visitors to re-download unchanged files. Set cache headers to at least 1 year for versioned assets.",
    pillar: "Cloud & DevOps" },
  { id: "total-blocking-time", impact: "high", effort: "involved",
    title: "Long JavaScript tasks block user interaction",
    detail: "Tasks over 50 ms on the main thread delay how quickly users can interact with the page (high Total Blocking Time).",
    pillar: "Web & Mobile Development" },
  { id: "largest-contentful-paint", impact: "high", effort: "involved",
    title: "Largest Contentful Paint is too slow",
    detail: "LCP marks when the main hero image or text block becomes visible. Values above 2.5 s hurt user experience and Core Web Vitals.",
    pillar: "Web & Mobile Development" },
  { id: "cumulative-layout-shift", impact: "medium", effort: "moderate",
    title: "Page elements shift as the page loads",
    detail: "Layout shifts (CLS) disorient users and can cause accidental taps. Reserve space for images and async-loaded content.",
    pillar: "Web & Mobile Development" },
  { id: "server-response-time", impact: "high", effort: "involved",
    title: "Server response time is too slow (TTFB)",
    detail: "Time to First Byte above 600 ms delays every other metric. Consider server-side caching, a CDN, or infrastructure upgrades.",
    pillar: "Cloud & DevOps" },
];

function performanceFixes(desktop: LhrSnapshot, mobile: LhrSnapshot): ReturnType<typeof makeFix>[] {
  const fixes: ReturnType<typeof makeFix>[] = [];
  for (const def of PERF_AUDITS) {
    if (auditFails(desktop, def.id) || auditFails(mobile, def.id)) {
      fixes.push(makeFix({
        id: `perf-${def.id}`,
        category: "performance",
        title: def.title,
        detail: def.detail,
        impact: def.impact,
        effort: def.effort,
        servicePillar: def.pillar,
      }));
    }
  }
  return fixes;
}

// ── SEO fixes ─────────────────────────────────────────────────────────────────

const SEO_AUDITS: Array<{
  id: string; title: string; detail: string;
  impact: Impact; effort: Effort;
}> = [
  { id: "document-title", impact: "high", effort: "quick",
    title: "Page is missing a title tag",
    detail: "The <title> tag is one of the most important on-page SEO signals. Every page needs a unique, descriptive title." },
  { id: "meta-description", impact: "high", effort: "quick",
    title: "Page has no meta description",
    detail: "Meta descriptions don't affect rankings directly but heavily influence click-through rates in search results." },
  { id: "link-text", impact: "medium", effort: "quick",
    title: "Some links use non-descriptive anchor text",
    detail: "Links like 'click here' or 'read more' provide no context for search engines or screen readers." },
  { id: "crawlable-anchors", impact: "high", effort: "quick",
    title: "Some links can't be followed by crawlers",
    detail: "Links using javascript: or empty href attributes are invisible to search engines, breaking link equity flow." },
  { id: "is-crawlable", impact: "high", effort: "quick",
    title: "Page is blocked from search engine crawling",
    detail: "A noindex tag or robots.txt rule is preventing this page from appearing in search results." },
  { id: "canonical", impact: "medium", effort: "quick",
    title: "No canonical URL is declared",
    detail: "Without a canonical tag, duplicate content issues can dilute ranking signals across multiple URL variants." },
  { id: "structured-data", impact: "low", effort: "moderate",
    title: "Page has no structured data markup",
    detail: "Schema.org markup can unlock rich results (star ratings, FAQs, events) in Google search, improving CTR." },
  { id: "image-alt", impact: "medium", effort: "quick",
    title: "Images are missing alt attributes",
    detail: "Missing alt text means search engines can't index image content, and screen readers can't describe images to users." },
];

function seoFixes(desktop: LhrSnapshot): ReturnType<typeof makeFix>[] {
  return SEO_AUDITS
    .filter((def) => auditFails(desktop, def.id))
    .map((def) => makeFix({
      id: `seo-${def.id}`,
      category: "seo",
      title: def.title,
      detail: def.detail,
      impact: def.impact,
      effort: def.effort,
      servicePillar: "Digital Marketing",
    }));
}

// ── Accessibility fixes ───────────────────────────────────────────────────────

const AXE_PLAIN_ENGLISH: Record<string, { title: string; detail: string; impact: Impact }> = {
  "color-contrast":        { impact: "serious" as unknown as Impact,
    title: "Text doesn't have enough contrast against its background",
    detail: "Low-contrast text is difficult or impossible to read for people with low vision or in bright lighting." },
  "image-alt":             { impact: "serious" as unknown as Impact,
    title: "Images are missing alternative text",
    detail: "Screen readers can't convey what an image shows without an alt attribute — leaving blind users with no context." },
  "button-name":           { impact: "serious" as unknown as Impact,
    title: "Buttons have no accessible name",
    detail: "Icon-only buttons without a label or aria-label are invisible to screen reader users." },
  "link-name":             { impact: "serious" as unknown as Impact,
    title: "Links have no accessible name",
    detail: "Empty or icon-only links leave screen reader users unable to determine the link's destination." },
  "label":                 { impact: "serious" as unknown as Impact,
    title: "Form inputs are missing labels",
    detail: "Without a <label>, screen reader users can't tell what a form field is asking for." },
  "aria-required-attr":    { impact: "serious" as unknown as Impact,
    title: "Required ARIA attributes are missing",
    detail: "ARIA roles sometimes require specific attributes; omitting them breaks assistive technology." },
  "aria-valid-attr-value": { impact: "serious" as unknown as Impact,
    title: "ARIA attributes have invalid values",
    detail: "Invalid attribute values cause unpredictable behaviour in screen readers." },
  "landmark-one-main":     { impact: "moderate" as unknown as Impact,
    title: "Page is missing a main landmark",
    detail: "A <main> element (or role='main') lets keyboard and screen reader users skip directly to the page's primary content." },
  "region":                { impact: "moderate" as unknown as Impact,
    title: "Page content is not contained in landmark regions",
    detail: "Wrapping content in semantic landmarks (header, main, nav, footer) makes navigation far faster for screen reader users." },
  "heading-order":         { impact: "moderate" as unknown as Impact,
    title: "Heading levels are out of sequence",
    detail: "Skipping from h1 to h4 breaks the document outline that screen readers use to navigate between sections." },
  "duplicate-id":          { impact: "moderate" as unknown as Impact,
    title: "Multiple elements share the same ID",
    detail: "Duplicate IDs break aria-labelledby and for/id form associations, causing confusing behaviour for assistive technology." },
  "html-has-lang":         { impact: "serious" as unknown as Impact,
    title: "Page is missing a language attribute",
    detail: "Without lang on <html>, screen readers can't pick the correct pronunciation rules for the page's content." },
  "frame-title":           { impact: "serious" as unknown as Impact,
    title: "iframes are missing title attributes",
    detail: "Screen readers need a title to tell users what content an embedded frame contains." },
  "select-name":           { impact: "serious" as unknown as Impact,
    title: "Select elements are missing labels",
    detail: "Unlabelled dropdowns give screen reader users no indication of what they're selecting." },
};

function axeImpactToImpact(axeImpact: string | null | undefined): Impact {
  if (axeImpact === "critical" || axeImpact === "serious") return "high";
  if (axeImpact === "moderate") return "medium";
  return "low";
}

function accessibilityFixes(raw: unknown): ReturnType<typeof makeFix>[] {
  const axe = (raw ?? {}) as AxeFindings;
  if (axe.error || !axe.violations?.length) return [];

  return axe.violations.map((v) => {
    const known = AXE_PLAIN_ENGLISH[v.id];
    return makeFix({
      id: `a11y-${v.id}`,
      category: "accessibility",
      title: known?.title ?? v.help ?? v.id,
      detail: known?.detail ?? v.description ?? "",
      impact: axeImpactToImpact(v.impact),
      effort: "moderate",
      servicePillar: "Web & Mobile Development",
    });
  });
}

// ── Mobile fixes ──────────────────────────────────────────────────────────────

const MOBILE_AUDITS: Array<{
  id: string; title: string; detail: string; impact: Impact; effort: Effort;
}> = [
  { id: "viewport", impact: "high", effort: "quick",
    title: "Page is missing a responsive viewport meta tag",
    detail: "Without <meta name='viewport'>, mobile browsers render the page at desktop width and users must zoom to read it." },
  { id: "tap-targets", impact: "medium", effort: "moderate",
    title: "Buttons and links are too small to tap comfortably",
    detail: "Touch targets smaller than 48×48 px are difficult to tap accurately, leading to accidental taps and frustration." },
  { id: "content-width", impact: "high", effort: "moderate",
    title: "Page content overflows the viewport on mobile",
    detail: "Horizontal scrolling on mobile is a strong signal of a non-responsive layout and degrades the experience significantly." },
  { id: "uses-responsive-images", impact: "medium", effort: "quick",
    title: "Images aren't optimised for mobile screen sizes",
    detail: "Serving full-size desktop images to mobile wastes data and slows load on cellular connections." },
];

function mobileFixes(mobile: LhrSnapshot): ReturnType<typeof makeFix>[] {
  return MOBILE_AUDITS
    .filter((def) => auditFails(mobile, def.id))
    .map((def) => makeFix({
      id: `mobile-${def.id}`,
      category: "mobile",
      title: def.title,
      detail: def.detail,
      impact: def.impact,
      effort: def.effort,
      servicePillar: "Web & Mobile Development",
    }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a prioritised top-fixes list from all raw probe data.
 * Returns at most `limit` fixes (default 8), highest priority first.
 * Each fix maps to a Centr8 service pillar with a placeholder URL.
 */
export function generateFixes(probes: RawProbes, limit = 8): Fix[] {
  const desktop = (probes.lighthouseDesktop ?? { audits: {} }) as LhrSnapshot;
  const mobile  = (probes.lighthouseMobile  ?? { audits: {} }) as LhrSnapshot;

  const all = [
    ...securityFixes(probes.securityJson),
    ...performanceFixes(desktop, mobile),
    ...seoFixes(desktop),
    ...accessibilityFixes(probes.axeJson),
    ...mobileFixes(mobile),
  ];

  // Deduplicate by id, sort by priority desc, take top N
  const seen = new Set<string>();
  return all
    .filter((f) => { if (seen.has(f.id)) return false; seen.add(f.id); return true; })
    .sort((a, b) => b._priority - a._priority)
    .slice(0, limit)
    .map(({ _priority: _, ...fix }) => fix); // strip internal field
}
