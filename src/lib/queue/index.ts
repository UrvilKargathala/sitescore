import { Queue } from "bullmq";
import { getRedisConfig } from "./redis";

export const SCAN_QUEUE      = "scan-queue";
export const REPORT_QUEUE    = "report-queue";
export const RETENTION_QUEUE = "retention-queue";

export const scanQueue = new Queue(SCAN_QUEUE, {
  connection: getRedisConfig(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

export const reportQueue = new Queue(REPORT_QUEUE, {
  connection: getRedisConfig(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10_000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail:     { age: 3600 * 24 * 7 },
  },
});

export const retentionQueue = new Queue(RETENTION_QUEUE, {
  connection: getRedisConfig(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 60_000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail:     { age: 3600 * 24 * 7 },
  },
});
