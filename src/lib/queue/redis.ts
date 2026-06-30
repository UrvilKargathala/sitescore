const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
const isTls = redisUrl.protocol === "rediss:";

export const redis = {
  host:     redisUrl.hostname,
  port:     Number(redisUrl.port) || (isTls ? 6380 : 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  tls:      isTls ? {} : undefined,
  maxRetriesPerRequest: null as null,
  enableReadyCheck:     false,
  connectTimeout:       3000,
  retryStrategy: (times: number) => (times <= 1 ? 200 : null),
};
