function buildRedisConfig() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is not set");

  const parsed = new URL(url);
  const isTls  = parsed.protocol === "rediss:";

  return {
    host:     parsed.hostname,
    port:     Number(parsed.port) || (isTls ? 6380 : 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls:      isTls ? {} : undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck:     false,
    connectTimeout:       3000,
    retryStrategy: (times: number) => (times <= 1 ? 200 : null),
  };
}

let _config: ReturnType<typeof buildRedisConfig> | null = null;

export function getRedisConfig() {
  if (!_config) _config = buildRedisConfig();
  return _config;
}

// Backwards-compatible named export used by BullMQ queues and anti-abuse
export const redis = new Proxy({} as ReturnType<typeof buildRedisConfig>, {
  get(_target, prop) {
    return getRedisConfig()[prop as keyof ReturnType<typeof buildRedisConfig>];
  },
});
