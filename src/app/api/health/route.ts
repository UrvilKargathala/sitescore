import { NextResponse } from "next/server";

/**
 * GET /api/health — verifies the Redis connection actually reaches the
 * configured host (Upstash in production), not a localhost fallback.
 */
export async function GET() {
  const { getRedisConfig } = await import("@/lib/queue/redis");

  let cfg: { host: string; port: number; tls: boolean };
  try {
    const c = getRedisConfig();
    cfg = { host: c.host, port: c.port, tls: !!c.tls };
  } catch (err) {
    return NextResponse.json(
      { status: "error", redis: { error: err instanceof Error ? err.message : String(err) } },
      { status: 503 }
    );
  }

  try {
    const Redis = (await import("ioredis")).default;
    const client = new Redis({ ...getRedisConfig(), maxRetriesPerRequest: 1, lazyConnect: true });
    await client.connect();
    const pong = await client.ping();
    await client.quit();

    return NextResponse.json({ status: "ok", redis: { ...cfg, ping: pong } });
  } catch (err) {
    return NextResponse.json(
      { status: "error", redis: { ...cfg, error: err instanceof Error ? err.message : String(err) } },
      { status: 503 }
    );
  }
}
