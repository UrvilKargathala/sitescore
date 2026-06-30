import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Postgres ScanStatus → frontend polling vocabulary
type ApiStatus = "queued" | "running" | "ready" | "failed";

function mapDbStatus(s: string): ApiStatus {
  switch (s) {
    case "PENDING":   return "queued";
    case "RUNNING":   return "running";
    case "COMPLETED": return "ready";
    case "FAILED":
    case "PARTIAL":   return "failed";
    default:          return "queued";
  }
}

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  // Primary source: Postgres — durable and survives BullMQ job cleanup
  const scan = await prisma.scan.findUnique({
    where: { jobId },
    select: {
      id: true,
      url: true,
      status: true,
      errorReason: true,
      completedAt: true,
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const status = mapDbStatus(scan.status);

  return NextResponse.json({
    jobId,
    scanId: scan.id,
    status,
    url: scan.url,
    ...(status === "failed" && scan.errorReason
      ? { error: scan.errorReason }
      : {}),
    ...(status === "ready" && scan.completedAt
      ? { completedAt: scan.completedAt.toISOString() }
      : {}),
  });
}
