/**
 * POST /api/delete
 *
 * Two modes:
 *   1. token=<signed>  — deletion link from PDF/email footer (per-lead)
 *   2. email=<addr>    — self-service form on /delete (all leads for that email)
 *
 * Both perform a hard delete of the Lead row(s). The Scan record is retained
 * for aggregate statistics — no PII remains in it after the Lead is gone.
 *
 * Rate-limited: 5 requests / 15 min per IP to prevent brute-force enumeration.
 */
import { NextRequest, NextResponse } from "next/server";
import { parseDeletionToken, deleteLeadById, deleteLeadsByEmail } from "@/lib/deletion";
import Redis from "ioredis";

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return _redis;
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

async function checkRateLimit(ip: string): Promise<boolean> {
  const r   = getRedis();
  const key = `rl:delete:${ip}`;
  const n   = await r.incr(key);
  if (n === 1) await r.expire(key, 15 * 60); // 15-min window
  return n <= 5;
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const ok = await checkRateLimit(ip).catch(() => true); // fail open on Redis error
  if (!ok) {
    return NextResponse.json(
      { error: "Too many deletion requests. Please try again in 15 minutes." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Mode 1: signed token from email/PDF footer ────────────────────────────
  if (typeof body.token === "string" && body.token) {
    const leadId = parseDeletionToken(body.token);
    if (!leadId) {
      return NextResponse.json(
        { error: "Invalid or expired deletion token." },
        { status: 400 }
      );
    }
    const { deleted } = await deleteLeadById(leadId);
    return NextResponse.json({
      deleted,
      message: deleted
        ? "Your data has been permanently deleted."
        : "No matching record found — it may have already been deleted.",
    });
  }

  // ── Mode 2: email self-service form ──────────────────────────────────────
  if (typeof body.email === "string" && body.email) {
    const email = body.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }
    const { deleted } = await deleteLeadsByEmail(email);
    // Always return the same message — don't reveal whether the email existed
    return NextResponse.json({
      deleted,
      message:
        "If we held data for that email address, it has now been permanently deleted.",
    });
  }

  return NextResponse.json(
    { error: "Provide either token or email in the request body." },
    { status: 400 }
  );
}
