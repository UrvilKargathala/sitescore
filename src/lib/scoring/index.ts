/**
 * FR-6 Scoring Rubric — v1
 *
 * Pure function: raw probe data in → scores + grades out.
 * No I/O, no side effects — easy to unit-test against known inputs.
 *
 * Overall score = weighted average of five category scores:
 *   Performance   25%
 *   Security      25%
 *   SEO           20%
 *   Accessibility 15%
 *   Mobile        15%
 *
 * Grade bands (applied independently to overall AND each category):
 *   green  90-100  (good)
 *   amber  50-89   (needs work)
 *   red    0-49    (critical)
 *
 * Bump RUBRIC_VERSION whenever the formula changes so historical rows
 * retain their original version and are never silently reinterpreted.
 */

export const RUBRIC_VERSION = "v1" as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type Grade    = "green" | "amber" | "red";
export type Category = "performance" | "seo" | "security" | "accessibility" | "mobile";

export interface CategoryScore {
  score: number; // integer 0-100
  grade: Grade;
}

export interface ScoredResult {
  rubricVersion: typeof RUBRIC_VERSION;
  computedAt: string;
  overall: CategoryScore;
  performance: CategoryScore;
  seo: CategoryScore;
  security: CategoryScore;
  accessibility: CategoryScore;
  mobile: CategoryScore;
  [key: string]: CategoryScore | string; // allow indexing by Category
}

// Minimal subset of the Lighthouse LHR JSON we actually read
interface LhrCategory {
  score: number | null;
}
interface LhrAudit {
  score: number | null;
}
interface LhrSnapshot {
  categories: {
    performance?: LhrCategory;
    accessibility?: LhrCategory;
    seo?: LhrCategory;
    "best-practices"?: LhrCategory;
  };
  audits: Record<string, LhrAudit | undefined>;
}

// Shape of the SecurityFindings stored in securityJson
interface SecurityFindings {
  error: string | null;
  https: { served: boolean; httpRedirectsToHttps: boolean | null };
  tls: {
    trusted: boolean;
    expired: boolean;
    selfSigned: boolean;
    error: string | null;
  };
  headers: Record<string, { present: boolean }>;
  versionBanners: {
    server: { exposed: boolean };
    xPoweredBy: { exposed: boolean };
  };
}

// Shape of the AxeFindings stored in axeJson
interface AxeFindings {
  error: string | null;
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export interface RawScanData {
  lighthouseDesktop: unknown;
  lighthouseMobile: unknown;
  securityJson: unknown;
  axeJson: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toGrade(score: number): Grade {
  if (score >= 90) return "green";
  if (score >= 50) return "amber";
  return "red";
}

/** Clamp to [0,100], round, and attach a grade. */
function cat(raw: number): CategoryScore {
  const score = Math.round(Math.max(0, Math.min(100, raw)));
  return { score, grade: toGrade(score) };
}

function asLhr(raw: unknown): LhrSnapshot {
  return raw as LhrSnapshot;
}

/** Read a Lighthouse category score as 0-100, defaulting to 0 on null. */
function lhCategory(snap: LhrSnapshot, key: string): number {
  const c = snap.categories[key as keyof LhrSnapshot["categories"]];
  return (c?.score ?? 0) * 100;
}

/** Read a Lighthouse audit score as 0-1, defaulting to 0 on null/missing. */
function lhAudit(snap: LhrSnapshot, key: string): number {
  return snap.audits[key]?.score ?? 0;
}

// ── Category formulas ─────────────────────────────────────────────────────────

/**
 * Performance
 * Formula: average of desktop and mobile Lighthouse performance scores.
 * Both passes use real throttling, so the average captures desktop and
 * low-end mobile conditions equally.
 */
function scorePerformance(desktop: LhrSnapshot, mobile: LhrSnapshot): number {
  return (lhCategory(desktop, "performance") + lhCategory(mobile, "performance")) / 2;
}

/**
 * SEO
 * Formula: desktop Lighthouse SEO score.
 * Desktop is the primary signal; crawlers and indexing are desktop-first.
 */
function scoreSeo(desktop: LhrSnapshot): number {
  return lhCategory(desktop, "seo");
}

/**
 * Security
 * Formula: deduction-based, start at 100.
 *
 * Deductions (cap at 0):
 *   HTTPS not served             -40   (serves over plain HTTP)
 *   HTTP does not redirect HTTPS -10   (port 80 reachable but no redirect)
 *   TLS expired                  -20
 *   TLS self-signed              -15
 *   TLS other trust error        -25   (catch-all for other validation failures)
 *   Missing HSTS                 -10
 *   Missing CSP                  -10
 *   Missing X-Frame-Options       -5
 *   Missing X-Content-Type-Opt.   -5
 *   Missing Referrer-Policy       -3
 *   Missing Permissions-Policy    -3
 *   Server version banner         -5
 *   X-Powered-By exposed          -3
 *
 * If the probe itself errored (network unreachable etc.) return 50 as a
 * neutral fallback so one flaky probe can't tank the overall score.
 */
function scoreSecurity(raw: unknown): number {
  const s = raw as SecurityFindings;
  if (!s || s.error) return 50;

  let score = 100;

  if (!s.https?.served) {
    score -= 40;
  } else {
    // Only meaningful for HTTPS sites (redirect from port 80)
    if (s.https.httpRedirectsToHttps === false) score -= 10;

    // TLS trust issues
    if (s.tls && !s.tls.trusted) {
      if (s.tls.expired)    score -= 20;
      else if (s.tls.selfSigned) score -= 15;
      else if (s.tls.error) score -= 25;
    }
  }

  const h = s.headers ?? {};
  if (!h.hsts?.present)                score -= 10;
  if (!h.csp?.present)                 score -= 10;
  if (!h.xFrameOptions?.present)       score -= 5;
  if (!h.xContentTypeOptions?.present) score -= 5;
  if (!h.referrerPolicy?.present)      score -= 3;
  if (!h.permissionsPolicy?.present)   score -= 3;

  if (s.versionBanners?.server?.exposed)     score -= 5;
  if (s.versionBanners?.xPoweredBy?.exposed) score -= 3;

  return score;
}

/**
 * Accessibility
 * Formula: 60% Lighthouse accessibility score + 40% axe-derived score.
 *
 * Lighthouse accessibility runs a focused subset of axe rules and gives a
 * weighted score; our separate axe pass covers a broader rule set.
 * Blending both surfaces issues neither catches alone.
 *
 * axe-derived score: start at 100, deduct per violation:
 *   critical  -15 per violation
 *   serious   -8  per violation
 *   moderate  -3  per violation
 *   minor     -1  per violation
 *   (floor 0)
 *
 * If axe errored, fall back to LH score alone (weight shifts to 100% LH).
 */
function scoreAccessibility(desktop: LhrSnapshot, axeRaw: unknown): number {
  const lhScore = lhCategory(desktop, "accessibility");
  const axe = axeRaw as AxeFindings;

  if (!axe || axe.error) return lhScore;

  const axeScore = Math.max(
    0,
    100 -
      (axe.summary.critical ?? 0) * 15 -
      (axe.summary.serious  ?? 0) * 8  -
      (axe.summary.moderate ?? 0) * 3  -
      (axe.summary.minor    ?? 0) * 1
  );

  return lhScore * 0.6 + axeScore * 0.4;
}

/**
 * Mobile
 * Formula: 60% mobile Lighthouse performance + 40% mobile-specific audits.
 *
 * Mobile-specific audits (each 0 or 1, averaged):
 *   viewport       — has a <meta name="viewport"> tag
 *   tap-targets    — interactive elements are large enough to tap
 *   content-width  — page content fits within the viewport
 *
 * These audits test responsiveness directly; the performance score tests
 * load speed on a throttled mobile connection.
 */
function scoreMobile(mobile: LhrSnapshot): number {
  const perfScore = lhCategory(mobile, "performance");

  const viewport     = lhAudit(mobile, "viewport")      * 100;
  const tapTargets   = lhAudit(mobile, "tap-targets")   * 100;
  const contentWidth = lhAudit(mobile, "content-width") * 100;
  const auditAvg     = (viewport + tapTargets + contentWidth) / 3;

  return perfScore * 0.6 + auditAvg * 0.4;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute all scores from raw probe data.
 *
 * @param data - Raw JSON blobs as stored in Postgres (lighthouseDesktop,
 *               lighthouseMobile, securityJson, axeJson).
 * @returns     ScoredResult with integer 0-100 scores and grade bands for
 *              every category plus the weighted overall score.
 */
export function computeScores(data: RawScanData): ScoredResult {
  const desktop = asLhr(data.lighthouseDesktop);
  const mobile  = asLhr(data.lighthouseMobile);

  const performance   = cat(scorePerformance(desktop, mobile));
  const seo           = cat(scoreSeo(desktop));
  const security      = cat(scoreSecurity(data.securityJson));
  const accessibility = cat(scoreAccessibility(desktop, data.axeJson));
  const mobile_       = cat(scoreMobile(mobile));

  const overall = cat(
    performance.score   * 0.25 +
    security.score      * 0.25 +
    seo.score           * 0.20 +
    accessibility.score * 0.15 +
    mobile_.score       * 0.15
  );

  return {
    rubricVersion: RUBRIC_VERSION,
    computedAt: new Date().toISOString(),
    overall,
    performance,
    seo,
    security,
    accessibility,
    mobile: mobile_,
  };
}
