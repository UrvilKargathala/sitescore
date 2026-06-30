import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, unknown> = {
    redis_url_set: !!process.env.REDIS_URL,
    redis_url_prefix: process.env.REDIS_URL?.slice(0, 12) ?? "NOT SET",
    database_url_set: !!process.env.DATABASE_URL,
    node_env: process.env.NODE_ENV,
  };

  // Test Redis connection
  try {
    const { getRedisConfig } = await import("@/lib/queue/redis");
    const cfg = getRedisConfig();
    results.redis_host = cfg.host;
    results.redis_port = cfg.port;
    results.redis_tls = !!cfg.tls;

    const Redis = (await import("ioredis")).default;
    const client = new Redis(cfg as never);
    await client.ping();
    await client.quit();
    results.redis_ping = "OK";
  } catch (err) {
    results.redis_error = err instanceof Error ? err.message : String(err);
  }

  // Test Prisma connection
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    results.db_ping = "OK";
  } catch (err) {
    results.db_error = err instanceof Error ? err.message : String(err);
  }

  // Test BullMQ queue add
  try {
    const { getScanQueue } = await import("@/lib/queue");
    await getScanQueue().add("debug-test", { test: true });
    results.queue_add = "OK";
  } catch (err) {
    results.queue_error = err instanceof Error ? err.message : String(err);
  }

  // Test reachability check
  try {
    const { assertReachable } = await import("@/lib/url");
    await assertReachable("https://example.com");
    results.reachability = "OK";
  } catch (err) {
    results.reachability_error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(results);
}
