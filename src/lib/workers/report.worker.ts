/**
 * FR-9 — Report generation orchestrator.
 *
 * Called by the report-queue worker (one lead + scan per job).
 * Fetches scan data, generates the PDF buffer, sends via Resend,
 * and updates the Lead delivery status in Postgres.
 *
 * BullMQ handles the retry: maxAttempts = 2 (1 try + 1 retry).
 * On final failure the worker marks deliveryStatus = "failed" and logs the error.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { prisma } from "../db";
import { sendReportEmail } from "../email";
import { SiteScoreReport } from "../pdf/report";
import { generateFixes } from "../scoring/top-fixes";
import { makeDeletionToken } from "../deletion";
import type { ScoredResult } from "../scoring";

export async function generateAndDeliverReport(
  leadId: string,
  scanId: string
): Promise<void> {
  // ── Fetch required data ───────────────────────────────────────────────────

  const [lead, scan] = await Promise.all([
    prisma.lead.findUniqueOrThrow({ where: { id: leadId } }),
    prisma.scan.findUniqueOrThrow({
      where: { id: scanId },
      select: {
        url:               true,
        resultJson:        true,
        lighthouseDesktop: true,
        lighthouseMobile:  true,
        securityJson:      true,
        axeJson:           true,
        completedAt:       true,
      },
    }),
  ]);

  if (!scan.resultJson) {
    throw new Error(`Scan ${scanId} has no resultJson — cannot generate report`);
  }

  const result = scan.resultJson as unknown as ScoredResult;
  const fixes  = generateFixes(
    {
      lighthouseDesktop: scan.lighthouseDesktop,
      lighthouseMobile:  scan.lighthouseMobile,
      securityJson:      scan.securityJson,
      axeJson:           scan.axeJson,
    },
    50 // PDF gets the full list, not capped at 8
  );

  const scanDate = scan.completedAt
    ? new Date(scan.completedAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : new Date().toLocaleDateString("en-GB");

  const hostname = (() => {
    try { return new URL(scan.url).hostname; } catch { return scan.url; }
  })();

  // ── Generate PDF ──────────────────────────────────────────────────────────

  console.log(`[report] generating PDF for ${hostname}`);

  // renderToBuffer expects a react-pdf Document element; cast through unknown
  // because react-pdf's type for renderToBuffer is overly strict about props.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(SiteScoreReport as any, {
    url: scan.url, result, fixes, scanDate,
  }) as unknown as Parameters<typeof renderToBuffer>[0];

  const pdfBuffer = await renderToBuffer(element);

  console.log(`[report] PDF generated (${Math.round(pdfBuffer.length / 1024)} KB)`);

  // ── Send email ────────────────────────────────────────────────────────────

  const deletionToken = makeDeletionToken(leadId);

  let messageId: string;
  try {
    messageId = await sendReportEmail({
      to:            lead.email,
      hostname,
      overallScore:  result.overall.score,
      grade:         result.overall.grade,
      pdfBuffer,
      deletionToken,
    });
  } catch (err) {
    // Update status to failed so the UI can surface a message
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        deliveryStatus: "failed",
        deliveryError:  err instanceof Error ? err.message : String(err),
      },
    });
    throw err; // rethrow so BullMQ can retry
  }

  // ── Mark as sent ──────────────────────────────────────────────────────────

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      deliveryStatus: "sent",
      pdfSentAt:      new Date(),
      deliveryError:  null,
    },
  });

  console.log(`[report] ✓ sent to ${lead.email} — Resend ID: ${messageId}`);
}
