/**
 * Runs Lighthouse against a URL using chrome-launcher pointed at Playwright's
 * managed Chromium binary. chrome-launcher sets up the CDP HTTP endpoint
 * (/json/version) that Lighthouse requires — Playwright's launchServer() does not.
 */
import { chromium } from "playwright";
import * as chromeLauncher from "chrome-launcher";
import type { Result as LHR } from "lighthouse";

import { performance } from "perf_hooks";

// Lighthouse v10+ is ESM-only; dynamic import avoids CJS interop issues.
async function getLighthouse() {
  const mod = await import("lighthouse");
  return mod.default as typeof import("lighthouse").default;
}

export interface LighthouseResults {
  desktop: LHR;
  mobile: LHR;
}

const DESKTOP_CONFIG = {
  formFactor: "desktop" as const,
  screenEmulation: {
    mobile: false,
    width: 1350,
    height: 940,
    deviceScaleFactor: 1,
    disabled: false,
  },
  throttling: {
    rttMs: 40,
    throughputKbps: 10_240,
    cpuSlowdownMultiplier: 1,
    requestLatencyMs: 0,
    downloadThroughputKbps: 0,
    uploadThroughputKbps: 0,
  },
};

const MOBILE_CONFIG = {
  formFactor: "mobile" as const,
  screenEmulation: {
    mobile: true,
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    disabled: false,
  },
  // Moto G4 preset
  throttling: {
    rttMs: 150,
    throughputKbps: 1_638.4,
    cpuSlowdownMultiplier: 2,
    requestLatencyMs: 562.5,
    downloadThroughputKbps: 1_474.56,
    uploadThroughputKbps: 675,
  },
};

async function runPass(
  lh: Awaited<ReturnType<typeof getLighthouse>>,
  url: string,
  port: number,
  config: typeof DESKTOP_CONFIG | typeof MOBILE_CONFIG
): Promise<LHR> {
  // Clear any stale marks left by a prior run that was killed mid-flight.
  // Lighthouse uses the global performance timeline; stale lh:* entries cause
  // "mark has not been set" errors on the next run in the same process.
  performance.clearMarks();
  performance.clearMeasures();

  const result = await lh(
    url,
    {
      port,
      output: "json",
      logLevel: "silent" as const,
      // Skip PWA — not in our scoring rubric, saves ~20 % of run time
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    },
    {
      extends: "lighthouse:default",
      settings: {
        ...config,
        maxWaitForLoad: 20_000,
      },
    }
  );

  if (!result?.lhr) throw new Error("Lighthouse returned no result");
  if (result.lhr.runtimeError) {
    throw new Error(
      `Lighthouse: ${result.lhr.runtimeError.code} — ${result.lhr.runtimeError.message}`
    );
  }

  return result.lhr;
}

/** Launch Chromium and return the chrome-launcher handle (caller must call kill()). */
export async function launchChrome() {
  return chromeLauncher.launch({
    chromePath: chromium.executablePath(),
    chromeFlags: [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
}

/** Run desktop then mobile Lighthouse passes, each with a fresh Chrome instance.
 *
 * Parallel runs share Node's global performance object and collide on
 * performance.mark() calls inside Lighthouse — so passes must be sequential.
 * Each pass still gets its own Chrome to avoid stale CDP state.
 */
export async function runLighthouse(url: string): Promise<LighthouseResults> {
  const lh = await getLighthouse();

  const desktopChrome = await launchChrome();
  let desktop: LHR;
  try {
    desktop = await runPass(lh, url, desktopChrome.port, DESKTOP_CONFIG);
  } finally {
    await desktopChrome.kill();
  }

  const mobileChrome = await launchChrome();
  let mobile: LHR;
  try {
    mobile = await runPass(lh, url, mobileChrome.port, MOBILE_CONFIG);
  } finally {
    await mobileChrome.kill();
  }

  return { desktop, mobile };
}
