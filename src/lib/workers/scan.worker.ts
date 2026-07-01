/**
 * Scan worker — runs as a separate process alongside Next.js.
 * Start with: npm run worker
 */
import "dotenv/config";
import { Worker, Job } from "bullmq";
import { getRedisConfig } from "../queue/redis";
import { SCAN_QUEUE } from "../queue";
import { prisma } from "../db";
import { runPageSpeed } from "./probes/pagespeed";
import { runAxe } from "./probes/axe";
import { runSecurityProbe } from "./probes/security";
import { computeScores, RUBRIC_VERSION } from "../scoring";
import { REPORT_QUEUE, RETENTION_QUEUE, getRetentionQueue } from "../queue";
import { generateAndDeliverReport } from "./report.worker";
import { purgeExpiredLeads } from "../deletion";
import type { ScanJobData, ReportJobData } from "../../types/scan";

const CONCURRENCY = 2; // PSI is a remote API call — no local Chrome for Lighthouse
const SCAN_TIMEOUT_MS = 120_000; // 2 min — PSI + axe together should finish well within this

// Map common Lighthouse/Chrome error strings to human-readable reasons
function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);

  if (/SCAN_TIMED_OUT/.test(msg))               return `Scan timed out after ${SCAN_TIMEOUT_MS / 1000} s.`;
  if (/net::ERR_NAME_NOT_RESOLVED/.test(msg))   return "DNS lookup failed — the domain could not be resolved.";
  if (/net::ERR_CONNECTION_REFUSED/.test(msg))  return "Connection refused — the server rejected the connection.";
  if (/net::ERR_CONNECTION_TIMED_OUT/.test(msg))return "Connection timed out — the server did not respond.";
  if (/net::ERR_SSL/.test(msg))                 return "SSL/TLS error — the site's certificate could not be verified.";
  if (/NO_FCP/.test(msg))                       return "Page failed to render — no content was painted within the timeout.";
  if (/runtime error/i.test(msg))               return msg;

  return `Scan failed: ${msg.slice(0, 200)}`;
}

async function processScan(job: Job<ScanJobData>) {
  const { scanId, url } = job.data;
  console.log(`[worker] job ${job.id} | scanId ${scanId} | ${url}`);

  await prisma.scan.update({
    where: { id: scanId },
    data: { status: "RUNNING" },
  });

  // Hard timeout — rejects after SCAN_TIMEOUT_MS with a recognisable message
  const timeoutError = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("SCAN_TIMED_OUT")),
      SCAN_TIMEOUT_MS
    )
  );

  // All three probes run in parallel:
  //   - PageSpeed: two remote PSI API calls (desktop + mobile) — no local Chrome
  //   - axe: one Playwright browser for accessibility injection
  //   - security: pure HTTP, no Chrome needed
  const [pageSpeedResult, axeResult, securityResult] = await Promise.race([
    Promise.all([
      runPageSpeed(url),
      runAxe(url),
      runSecurityProbe(url),
    ]),
    timeoutError,
  ]);

  const { desktop, mobile } = pageSpeedResult;

  console.log(
    `[worker] security probe done — HTTPS:${securityResult.https.served}`,
    `TLS valid:${securityResult.tls.valid}`,
    `HSTS:${securityResult.headers.hsts.present}`
  );
  console.log(
    `[worker] axe done — violations:${axeResult.summary.total}`,
    `(critical:${axeResult.summary.critical} serious:${axeResult.summary.serious})`,
    axeResult.error ? `error:${axeResult.error}` : ""
  );

  const scored = computeScores({
    lighthouseDesktop: desktop,        // PSI lighthouseResult — identical LHR shape
    lighthouseMobile:  mobile,
    securityJson:      securityResult,
    axeJson:           axeResult,
  });

  console.log(
    `[worker] scores — overall:${scored.overall.score} (${scored.overall.grade})`,
    `perf:${scored.performance.score}`,
    `seo:${scored.seo.score}`,
    `sec:${scored.security.score}`,
    `a11y:${scored.accessibility.score}`,
    `mobile:${scored.mobile.score}`
  );

  await prisma.scan.update({
    where: { id: scanId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      rulebookVersion:   RUBRIC_VERSION,
      lighthouseDesktop: desktop as object, // PSI lighthouseResult — same LHR shape
      lighthouseMobile:  mobile as object,
      securityJson:      securityResult as object,
      axeJson:           axeResult as object,
      resultJson:        scored as object,
      // Indexed integer columns for fast queries / leaderboard sorting
      overallScore:       scored.overall.score,
      performanceScore:   scored.performance.score,
      seoScore:           scored.seo.score,
      securityScore:      scored.security.score,
      accessibilityScore: scored.accessibility.score,
      mobileScore:        scored.mobile.score,
    },
  });

  console.log(`[worker] ✓ job ${job.id} complete`);
}

const worker = new Worker<ScanJobData>(
  SCAN_QUEUE,
  async (job: Job<ScanJobData>) => {
    const { scanId } = job.data;

    try {
      await processScan(job);
    } catch (err) {
      const reason = classifyError(err);
      console.error(`[worker] ✗ job ${job.id} failed:`, reason);

      // Persist the failure reason so the status endpoint can surface it
      await prisma.scan
        .update({
          where: { id: scanId },
          data: { status: "FAILED", errorReason: reason },
        })
        .catch((e: Error) =>
          console.error("[worker] failed to write error to DB:", e.message)
        );

      // Re-throw so BullMQ marks the job as failed and applies retry policy
      throw err;
    }
  },
  {
    connection: getRedisConfig(),
    concurrency: CONCURRENCY,
    // stalledInterval: how often BullMQ checks for jobs whose worker process
    // was OOM-killed or crashed mid-run without marking the job done/failed.
    // lockDuration must exceed SCAN_TIMEOUT_MS so the job isn't falsely
    // treated as stalled while Chrome is legitimately still running.
    lockDuration: 150_000,    // 2.5 min lock — longer than SCAN_TIMEOUT_MS (2 min)
    stalledInterval: 30_000,  // check for stalled jobs every 30 s
    maxStalledCount: 1,       // retry once, then mark failed
  }
);

worker.on("failed", (job, err) =>
  console.error(`[worker] BullMQ marked job ${job?.id} failed:`, err.message)
);

worker.on("error", (err) =>
  console.error("[worker] Redis connection error:", err.message)
);

// ── Report worker ─────────────────────────────────────────────────────────────

const reportWorker = new Worker<ReportJobData>(
  REPORT_QUEUE,
  async (job: Job<ReportJobData>) => {
    const { leadId, scanId } = job.data;
    console.log(`[report] job ${job.id} | leadId ${leadId} | scanId ${scanId}`);
    await generateAndDeliverReport(leadId, scanId);
  },
  {
    connection: getRedisConfig(),
    concurrency: 2,
  }
);

reportWorker.on("failed", (job, err) => {
  console.error(`[report] job ${job?.id} failed after all retries:`, err.message);
});
reportWorker.on("error", (err) =>
  console.error("[report] Redis connection error:", err.message)
);

// ── Retention worker — nightly sweep of expired lead PII ─────────────────────

const retentionWorker = new Worker(
  RETENTION_QUEUE,
  async () => {
    const deleted = await purgeExpiredLeads();
    console.log(`[retention] sweep complete — removed ${deleted} expired lead(s)`);
  },
  { connection: getRedisConfig(), concurrency: 1 }
);

retentionWorker.on("failed", (job, err) =>
  console.error(`[retention] job ${job?.id} failed:`, err.message)
);
retentionWorker.on("error", (err) =>
  console.error("[retention] Redis connection error:", err.message)
);

// Schedule the nightly retention sweep as a repeatable BullMQ job.
// Runs at 02:00 UTC every day. Safe to call multiple times — BullMQ deduplicates
// repeatable jobs by their repeat key.
getRetentionQueue()
  .add(
    "nightly-sweep",
    {},
    {
      repeat:    { pattern: "0 2 * * *" }, // 02:00 UTC daily
      jobId:     "retention-nightly",
      attempts:  2,
    }
  )
  .catch((e: Error) =>
    console.error("[retention] failed to schedule repeatable job:", e.message)
  );

console.log(
  `[worker] listening on "${SCAN_QUEUE}" (concurrency: ${CONCURRENCY}, timeout: ${SCAN_TIMEOUT_MS / 1000}s)`
);
console.log(`[worker] listening on "${REPORT_QUEUE}" (concurrency: 2)`);
console.log(`[worker] listening on "${RETENTION_QUEUE}" (nightly at 02:00 UTC)`);
