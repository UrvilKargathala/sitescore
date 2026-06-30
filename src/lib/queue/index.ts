import { Queue } from "bullmq";
import { redis } from "./redis";

export const SCAN_QUEUE      = "scan-queue";
export const REPORT_QUEUE    = "report-queue";
export const RETENTION_QUEUE = "retention-queue";

export const scanQueue = new Queue(SCAN_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});

// PDF report queue — max 2 attempts (1 try + 1 retry) per FR-9
export const reportQueue = new Queue(REPORT_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10_000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail:     { age: 3600 * 24 * 7 },
  },
});

// Retention expiry queue — worker schedules a repeatable job to purge expired leads
export const retentionQueue = new Queue(RETENTION_QUEUE, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 60_000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail:     { age: 3600 * 24 * 7 },
  },
});
