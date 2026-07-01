/**
 * Google PageSpeed Insights v5 probe — replaces local Lighthouse/Chrome.
 *
 * Makes two API calls (desktop + mobile) and returns the `lighthouseResult`
 * from each. The PSI response shape is identical to a Lighthouse LHR, so
 * scoring.ts consumes it without any changes.
 *
 * Quota: 25,000 requests/day on a free API key (12,500 scans).
 * Docs: https://developers.google.com/speed/docs/insights/v5/get-started
 */

const PSI_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const CATEGORIES = ["performance", "accessibility", "seo", "best-practices"]
  .map((c) => `category=${encodeURIComponent(c)}`)
  .join("&");

// Minimal subset of the PSI / LHR structure that scoring.ts reads.
// The real response is much larger — we only type what we use.
export interface LhrSnapshot {
  categories: {
    performance?:      { score: number | null };
    accessibility?:    { score: number | null };
    seo?:              { score: number | null };
    "best-practices"?: { score: number | null };
  };
  audits: Record<string, { score: number | null } | undefined>;
}

export interface PageSpeedResults {
  desktop: LhrSnapshot;
  mobile:  LhrSnapshot;
}

async function fetchStrategy(
  url: string,
  strategy: "desktop" | "mobile",
  apiKey: string
): Promise<LhrSnapshot> {
  const endpoint =
    `${PSI_ENDPOINT}?url=${encodeURIComponent(url)}` +
    `&strategy=${strategy}` +
    `&${CATEGORIES}` +
    `&key=${apiKey}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000); // PSI can be slow

  let res: Response;
  try {
    res = await fetch(endpoint, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`PageSpeed API ${strategy} HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  const body = await res.json() as { lighthouseResult?: LhrSnapshot; error?: { message: string } };

  if (body.error) {
    throw new Error(`PageSpeed API error: ${body.error.message}`);
  }

  if (!body.lighthouseResult) {
    throw new Error("PageSpeed API returned no lighthouseResult");
  }

  return body.lighthouseResult;
}

export async function runPageSpeed(url: string): Promise<PageSpeedResults> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY environment variable is not set");

  // Run desktop and mobile in parallel — independent API calls
  const [desktop, mobile] = await Promise.all([
    fetchStrategy(url, "desktop", apiKey),
    fetchStrategy(url, "mobile",  apiKey),
  ]);

  return { desktop, mobile };
}
