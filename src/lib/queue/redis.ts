// BullMQ ships its own ioredis — pass a plain connection options object, not an external IORedis instance.
const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");

export const redis = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  maxRetriesPerRequest: null as null, // required by BullMQ workers
  enableReadyCheck: false,
  connectTimeout: 3000,             // fail fast instead of hanging
  // Give up after one reconnect attempt in the API process;
  // the worker manages its own longer retry strategy separately.
  retryStrategy: (times: number) => (times <= 1 ? 200 : null),
};
