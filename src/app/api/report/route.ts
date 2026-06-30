/**
 * POST /api/report
 *
 * FR-8 lead capture: validate email + consent, upsert Lead record,
 * enqueue a PDF report job, and return immediately (job runs async).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getReportQueue } from "@/lib/queue";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { scanId, email: rawEmail, consent } = body as Record<string, unknown>;

  // ── Validate inputs ───────────────────────────────────────────────────────

  if (typeof scanId !== "string" || !scanId) {
    return NextResponse.json({ error: "scanId is required" }, { status: 400 });
  }
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
  }
  if (consent !== true) {
    return NextResponse.json(
      { error: "Consent is required to receive the report" },
      { status: 400 }
    );
  }

  // ── Verify scan exists and is complete ────────────────────────────────────

  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { id: true, status: true, resultJson: true },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }
  if (scan.status !== "COMPLETED" || !scan.resultJson) {
    return NextResponse.json(
      { error: "Scan is not yet complete — try again shortly" },
      { status: 409 }
    );
  }

  // ── Upsert Lead ───────────────────────────────────────────────────────────
  // One Lead per scan. Resubmitting with a different email updates the record
  // and re-triggers delivery.

  const now        = new Date();
  const expiresAt  = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 2); // 2 yr retention

  const lead = await prisma.lead.upsert({
    where:  { scanId },
    create: {
      scanId,
      email,
      consent:        true,
      consentAt:      now,
      deliveryStatus: "pending",
      expiresAt,
    },
    update: {
      email,
      consent:        true,
      consentAt:      now,
      deliveryStatus: "pending",
      deliveryError:  null,
    },
  });

  // ── Enqueue PDF generation job ────────────────────────────────────────────

  const job = await getReportQueue().add(
    "generate-report",
    { leadId: lead.id, scanId },
    { jobId: `report-${lead.id}` } // idempotent: same lead re-queues to same jobId
  );

  // Store job ID so we can track it against the Lead
  await prisma.lead.update({
    where: { id: lead.id },
    data:  { deliveryJobId: job.id?.toString() ?? null },
  });

  return NextResponse.json({ message: "Report on its way to your inbox!" });
}
