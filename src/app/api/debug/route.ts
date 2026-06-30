import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    redis_url_set: !!process.env.REDIS_URL,
    redis_url_prefix: process.env.REDIS_URL?.slice(0, 12) ?? "NOT SET",
    database_url_set: !!process.env.DATABASE_URL,
    node_env: process.env.NODE_ENV,
  });
}
