import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";
import { EmailJobPayload } from "../types";

export const EMAIL_QUEUE_NAME = "email-send-queue";

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 60 * 60 * 24 * 7 }, // keep 7 days for dashboard/history
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  },
});

/**
 * Adds (or re-attaches to) a delayed send job for an email row.
 *
 * Idempotency: we always use the email_jobs.id (a UUID that is the DB
 * primary key) as the BullMQ jobId. BullMQ de-dupes on jobId within a
 * queue — calling add() again with the same jobId for a job that is
 * already waiting/delayed/active simply returns the existing job instead
 * of creating a duplicate, so the same email can never be enqueued twice,
 * whether this is the first schedule call or a restart-recovery pass.
 */
export async function enqueueEmailSend(
  emailJobId: string,
  payload: EmailJobPayload,
  scheduledAtMs: number
) {
  const delay = Math.max(0, scheduledAtMs - Date.now());
  return emailQueue.add("send-email", payload, {
    jobId: emailJobId,
    delay,
  });
}
