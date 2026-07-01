/**
 * Accessibility probe — launches a headless Chromium browser via Playwright,
 * navigates to the URL, and injects axe-core to audit the page.
 *
 * Output MUST be presented as an automated scan, never as a certified WCAG
 * audit. axe-core detects ~30-40% of real accessibility issues.
 */
import { chromium } from "playwright";
// axe-core ships its injectable script as `.source`
// eslint-disable-next-line @typescript-eslint/no-require-imports
const axeCore = require("axe-core") as { source: string };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AxeFindings {
  disclaimer: string;
  runAt: string;
  url: string;
  error: string | null;

  summary: {
    critical:   number;
    serious:    number;
    moderate:   number;
    minor:      number;
    total:      number;
    passes:     number;
    incomplete: number;
  };

  violations: Array<{
    id:           string;
    impact:       string | null;
    description:  string;
    help:         string;
    helpUrl:      string;
    wcagCriteria: string[];
    nodes: Array<{
      target:         string[];
      html:           string;
      failureSummary: string;
    }>;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DISCLAIMER =
  "Automated accessibility scan — not a certified WCAG audit. " +
  "axe-core detects approximately 30–40% of real accessibility issues.";

function emptyFindings(url: string, error: string): AxeFindings {
  return {
    disclaimer: DISCLAIMER,
    runAt: new Date().toISOString(),
    url,
    error,
    summary: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0, passes: 0, incomplete: 0 },
    violations: [],
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Run axe-core against `url` using a dedicated Playwright browser.
 * Launches and kills its own browser — no shared Chrome state.
 */
export async function runAxe(url: string): Promise<AxeFindings> {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--mute-audio",
      ],
    });
  } catch (err) {
    return emptyFindings(
      url,
      `Could not launch browser: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const context = await browser.newContext();
  try {
    const page = await context.newPage();

    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

    // Inject the axe-core script into the page context
    await page.addScriptTag({ content: axeCore.source });

    const raw = await page.evaluate(() => {
      return (window as unknown as {
        axe: { run: (opts: unknown) => Promise<unknown> };
      }).axe.run({
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
        },
      });
    }) as {
      violations: Array<{
        id: string;
        impact?: string | null;
        description: string;
        help: string;
        helpUrl: string;
        tags: string[];
        nodes: Array<{ target: unknown[]; html: string; failureSummary?: string }>;
      }>;
      passes:     unknown[];
      incomplete: unknown[];
    };

    const violations = raw.violations.map((v) => ({
      id:          v.id,
      impact:      v.impact ?? null,
      description: v.description,
      help:        v.help,
      helpUrl:     v.helpUrl,
      wcagCriteria: v.tags.filter((t) => /^wcag/.test(t) || t === "best-practice"),
      nodes: v.nodes.slice(0, 5).map((n) => ({
        target:         n.target.map(String),
        html:           n.html.slice(0, 500),
        failureSummary: n.failureSummary ?? "",
      })),
    }));

    const count = (impact: string) => violations.filter((v) => v.impact === impact).length;

    return {
      disclaimer: DISCLAIMER,
      runAt:      new Date().toISOString(),
      url,
      error: null,
      summary: {
        critical:   count("critical"),
        serious:    count("serious"),
        moderate:   count("moderate"),
        minor:      count("minor"),
        total:      violations.length,
        passes:     raw.passes.length,
        incomplete: raw.incomplete.length,
      },
      violations,
    };
  } catch (err) {
    return emptyFindings(
      url,
      `axe scan failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    try { await context.close(); } catch { /* ignore */ }
    try { await browser.close(); } catch { /* ignore */ }
  }
}
