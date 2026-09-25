import { Worker, DelayedError, Job } from "bullmq";
import { redisConnection } from "../config/redis";
import { env } from "../config/env";
import { pool } from "../config/db";
import { EMAIL_QUEUE_NAME } from "./emailQueue";
import { EmailJobPayload } from "../types";
import { tryReserveHourlySlot, nextHourWindowStart } from "../services/rateLimiter";
import { sendEmail } from "../services/emailSender";
import { notifySlackRateLimitHit } from "../services/slackNotifier";
import { indexEmailJob } from "../services/elasticsearchClient";

async function processor(job: Job<EmailJobPayload>, token?: string) {
  const {
    emailJobId,
    senderEmail,
    recipientEmail,
    subject,
    body,
    hourlyLimitPerSender,
    hourlyLimitGlobal,
  } = job.data;

  // --- Hourly rate limit check (Redis-backed, safe across workers) ---
  const allowed = await tryReserveHourlySlot(
    senderEmail,
    hourlyLimitGlobal,
    hourlyLimitPerSender
  );

  if (!allowed) {
    const nextWindow = nextHourWindowStart(Date.now());
    await pool.query(
      `UPDATE email_jobs SET status = 'requeued', updated_at = now() WHERE id = $1`,
      [emailJobId]
    );

    const { rows } = await pool.query(
      `SELECT user_id FROM email_jobs WHERE id = $1`,
      [emailJobId]
    );
    await notifySlackRateLimitHit({
      userId: rows[0]?.user_id ?? null,
      senderEmail,
      limitType: "per-sender",
      limitValue: hourlyLimitPerSender,
    });

    // Move the SAME job into the next hour window instead of failing or
    // dropping it — order is preserved because it re-enters the delayed
    // set at (roughly) the same relative position as other requeued jobs.
    if (token) {
      await job.moveToDelayed(nextWindow, token);
    }
    throw new DelayedError();
  }

  // --- Mark processing (idempotency guard: skip if already sent) ---
  const current = await pool.query(
    `SELECT status FROM email_jobs WHERE id = $1`,
    [emailJobId]
  );
  if (current.rows[0]?.status === "sent") {
    return { skipped: true, reason: "already sent" };
  }

  await pool.query(
    `UPDATE email_jobs SET status = 'processing', attempts = attempts + 1, updated_at = now() WHERE id = $1`,
    [emailJobId]
  );

  try {
    if (subject?.includes("[FAIL]")) {
      throw new Error("Simulated mock failure");
    }
    if (subject?.includes("[LONG]")) {
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }

    const result = await sendEmail({
      from: senderEmail,
      to: recipientEmail,
      subject,
      html: body,
    });

    const { rows } = await pool.query(
      `UPDATE email_jobs
       SET status = 'sent', sent_at = now(), last_error = NULL, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [emailJobId]
    );
    if (rows[0]) await indexEmailJob(rows[0]);

    console.log(
      `[worker] sent ${recipientEmail} — preview: ${result.previewUrl || "n/a"}`
    );
    return { messageId: result.messageId, previewUrl: result.previewUrl };
  } catch (err: any) {
    await pool.query(
      `UPDATE email_jobs SET status = 'failed', last_error = $2, updated_at = now() WHERE id = $1`,
      [emailJobId, String(err?.message || err)]
    );
    throw err; // let BullMQ retry with backoff up to configured attempts
  }
}

export function startEmailWorker() {
  const worker = new Worker<EmailJobPayload>(EMAIL_QUEUE_NAME, processor, {
    connection: redisConnection,
    concurrency: env.workerConcurrency,
    // Global throttle mimicking provider throttling: at most one job
    // completes processing per `minDelayBetweenEmailsMs`, regardless of
    // how many concurrent workers are running. This is the "minimum delay
    // between individual email sends" requirement.
    limiter: {
      max: 1,
      duration: env.minDelayBetweenEmailsMs,
    },
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`[worker] job ${job.id} completed`);
  });

  return worker;
}
