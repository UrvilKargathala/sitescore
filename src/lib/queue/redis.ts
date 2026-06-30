let _config: ReturnType<typeof build> | null = null;

function build() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is not set");
  const parsed = new URL(url);
  const isTls  = parsed.protocol === "rediss:";
  return {
    host:                 parsed.hostname,
    port:                 Number(parsed.port) || (isTls ? 6380 : 6379),
    username:             parsed.username || undefined,
    password:             parsed.password || undefined,
    tls:                  isTls ? {} : undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck:     false,
    connectTimeout:       3000,
    retryStrategy:        (times: number) => (times <= 1 ? 200 : null),
  };
}

export function getRedisConfig() {
  if (!_config) _config = build();
  return _config;
}
