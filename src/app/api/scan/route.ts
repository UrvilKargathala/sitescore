import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  normalizeUrl,
  assertPublicUrl,
  assertReachable,
  UrlValidationError,
} from "@/lib/url";
import { scanQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";
import {
  checkIpRateLimit,
  checkDomainRateLimit,
  findCachedScan,
  isBlockedByRobots,
  RateLimitError,
} from "@/lib/anti-abuse";

const RequestSchema = z.object({
  url: z.string().min(1, "URL is required"),
});

/** Best-effort IP extraction from Next.js request headers. */
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  // 1. Parse body
  let raw: string;
  try {
    const body = RequestSchema.parse(await req.json());
    raw = body.url;
  } catch {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // 2. Normalize: add scheme if missing, strip fragments
  let normalized: string;
  try {
    normalized = normalizeUrl(raw);
  } catch {
    return NextResponse.json(
      { error: "That doesn't look like a valid URL. Please include a domain name." },
      { status: 422 }
    );
  }

  // 3. SSRF guard: reject private/internal targets
  try {
    await assertPublicUrl(normalized);
  } catch (err) {
    if (err instanceof UrlValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  const hostname = new URL(normalized).hostname;
  const ip       = getClientIp(req);

  // 4. Per-IP rate limit (5 scans / hour)
  try {
    await checkIpRateLimit(ip);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, {
        status: 429,
        headers: { "Retry-After": String(err.retryAfterSecs) },
      });
    }
    throw err;
  }

  // 5. Scan result cache — serve existing completed scan transparently
  const cached = await findCachedScan(hostname);
  if (cached) {
    console.log("[scan] cache hit for", hostname, "→ scanId", cached.id);
    return NextResponse.json(
      { scanId: cached.id, normalized: cached.url, cached: true },
      { status: 200 }
    );
  }

  // 6. Per-domain rate limit (1 scan / 10 min) — after cache so a fresh
  //    domain only gets one scan in flight at a time
  try {
    await checkDomainRateLimit(hostname);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json({ error: err.message }, {
        status: 429,
        headers: { "Retry-After": String(err.retryAfterSecs) },
      });
    }
    throw err;
  }

  // 7. robots.txt — fail open (network error → allowed)
  const robotsBlocked = await isBlockedByRobots(normalized);
  if (robotsBlocked) {
    return NextResponse.json(
      {
        error:
          `${hostname} has disallowed automated scanning in its robots.txt. ` +
          "SiteScore respects robots.txt and will not scan this site.",
      },
      { status: 451 }
    );
  }

  // 8. Reachability check: HEAD request before we queue anything
  try {
    await assertReachable(normalized);
  } catch (err) {
    if (err instanceof UrlValidationError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  // 9. Create Scan record in DB
  const origin = new URL(normalized).origin;
  const scan = await prisma.scan.create({
    data: { url: normalized, origin, status: "PENDING" },
  });

  // 10. Enqueue — race against 5 s so a down Redis returns a clean error
  let job: Awaited<ReturnType<typeof scanQueue.add>>;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Queue unavailable")), 5000)
    );
    job = await Promise.race([
      scanQueue.add("scan", { scanId: scan.id, url: normalized }),
      timeout,
    ]);
  } catch (err) {
    await prisma.scan.delete({ where: { id: scan.id } }).catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[scan] failed to enqueue:", msg);
    return NextResponse.json(
      { error: "The scan queue is temporarily unavailable. Is Redis running?" },
      { status: 503 }
    );
  }

  await prisma.scan.update({ where: { id: scan.id }, data: { jobId: job.id } });

  console.log("[scan] enqueued job", job.id, "scanId", scan.id, "for", normalized);

  return NextResponse.json({ jobId: job.id, scanId: scan.id, normalized }, { status: 202 });
}
