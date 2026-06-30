/**
 * FR-11 — Anti-abuse layer.
 *
 * All checks use Redis so they work across multiple API processes and survive
 * restarts. The Redis client here is a plain ioredis instance (not the BullMQ
 * config object used in queue/redis.ts).
 *
 * Checks (in order applied by the scan API):
 *   1. Per-IP rate limit      — 5 scans / hour per IP
 *   2. Per-domain rate limit  — 1 scan / 10 min per target domain
 *   3. Recent-scan cache      — return existing scan if completed in last 24 h
 *   4. robots.txt             — skip or flag if Disallow covers "/"
 */

import Redis from "ioredis";
import { prisma } from "./db";
import { redis as redisConfig } from "./queue/redis";

// ── Redis client ───────────────────────────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({ ...redisConfig, maxRetriesPerRequest: 1, lazyConnect: true });
    _redis.on("error", (e) => console.error("[anti-abuse] Redis error:", e.message));
  }
  return _redis;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  constructor(
    public readonly kind: "ip" | "domain",
    public readonly retryAfterSecs: number,
    message: string
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class RobotsBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RobotsBlockedError";
  }
}

// ── 1. Per-IP rate limit ──────────────────────────────────────────────────────

const IP_MAX    = 5;      // scans per window
const IP_WINDOW = 3600;   // 1 hour in seconds

export async function checkIpRateLimit(ip: string): Promise<void> {
  const r   = getRedis();
  const key = `rl:ip:${ip}`;

  const count = await r.incr(key);
  if (count === 1) await r.expire(key, IP_WINDOW);

  if (count > IP_MAX) {
    const ttl = await r.ttl(key);
    const mins = Math.ceil(ttl / 60);
    throw new RateLimitError(
      "ip",
      ttl,
      `Too many scans from your IP. You can run up to ${IP_MAX} scans per hour. ` +
        `Please try again in ${mins} minute${mins !== 1 ? "s" : ""}.`
    );
  }
}

// ── 2. Per-domain rate limit ──────────────────────────────────────────────────

const DOMAIN_WINDOW = 600; // 10 minutes in seconds

export async function checkDomainRateLimit(hostname: string): Promise<void> {
  const r   = getRedis();
  const key = `rl:domain:${hostname}`;

  const existing = await r.get(key);
  if (existing) {
    const ttl  = await r.ttl(key);
    const mins = Math.ceil(ttl / 60);
    throw new RateLimitError(
      "domain",
      ttl,
      `${hostname} was scanned very recently. To avoid hammering the target site, ` +
        `please wait ${mins} minute${mins !== 1 ? "s" : ""} before scanning it again.`
    );
  }

  await r.set(key, "1", "EX", DOMAIN_WINDOW);
}

// ── 3. Scan result cache — return existing completed scan ─────────────────────

const CACHE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function findCachedScan(
  hostname: string
): Promise<{ id: string; url: string } | null> {
  const since = new Date(Date.now() - CACHE_WINDOW_MS);

  // Match on the origin (scheme + host) so http/https variants still hit the cache
  const scan = await prisma.scan.findFirst({
    where: {
      origin:      { contains: hostname },
      status:      "COMPLETED",
      completedAt: { gte: since },
      resultJson: { not: "null" as never },
    },
    orderBy: { completedAt: "desc" },
    select:  { id: true, url: true },
  });

  return scan ?? null;
}

// ── 4. robots.txt check ───────────────────────────────────────────────────────

const ROBOTS_TIMEOUT_MS = 5_000;
const SITESCORE_UA      = "SiteScore/1.0 (automated site health scanner; read-only)";

/**
 * Fetch robots.txt and return true if the root path "/" is disallowed for
 * either the wildcard agent ("*") or "SiteScore".
 *
 * We only scan the root page, so only "/" matters.
 * A missing robots.txt → allowed (standard interpretation).
 * A fetch error → allowed (fail open; don't block scans on a flaky robots.txt).
 */
export async function isBlockedByRobots(url: string): Promise<boolean> {
  let robotsUrl: string;
  try {
    const origin = new URL(url).origin;
    robotsUrl = `${origin}/robots.txt`;
  } catch {
    return false;
  }

  let text: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ROBOTS_TIMEOUT_MS);
    const res = await fetch(robotsUrl, {
      signal:  ctrl.signal,
      headers: { "User-Agent": SITESCORE_UA },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return false; // 404 / 5xx → assume allowed
    text = await res.text();
  } catch {
    return false; // network error → fail open
  }

  return parseRobotsTxt(text);
}

/** Parse robots.txt for rules that block "/" for "*" or "SiteScore" agents. */
function parseRobotsTxt(text: string): boolean {
  const lines      = text.split(/\r?\n/);
  let inScope      = false; // whether current User-agent block applies to us
  let blocked      = false;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const [field, ...rest] = line.split(":").map((s) => s.trim());
    const value = rest.join(":").trim();

    const fieldLower = field.toLowerCase();
    const valueLower = value.toLowerCase();

    if (fieldLower === "user-agent") {
      if (valueLower === "*" || valueLower === "sitescore") {
        inScope = true;
      } else {
        // Different agent block — only reset if we were already done with ours
        inScope = false;
      }
      continue;
    }

    if (!inScope) continue;

    if (fieldLower === "disallow") {
      // Disallow: /   or   Disallow: /*   blocks the root
      if (value === "/" || value === "/*" || value === "") {
        // empty Disallow means allow everything
        if (value !== "") blocked = true;
      }
    }

    if (fieldLower === "allow") {
      // Allow: / overrides a prior Disallow: /
      if (value === "/" || value === "/*") {
        blocked = false;
      }
    }
  }

  return blocked;
}
