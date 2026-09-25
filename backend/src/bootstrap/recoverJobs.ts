import { pool } from "../config/db";
import { emailQueue, enqueueEmailSend } from "../queues/emailQueue";
import { env } from "../config/env";
import { EmailJobRow } from "../types";

/**
 * Runs once on every server boot.
 *
 * BullMQ itself persists delayed/waiting jobs in Redis, so a plain app
 * restart (Redis stays up) already resumes exactly where it left off —
 * that's the primary persistence mechanism and requires no action here.
 *
 * This pass exists for the harder case: Redis data was lost/flushed (e.g.
 * a fresh container, or Redis restarted without a persistent volume) while
 * Postgres — the source of truth for *what* was scheduled — survived. We
 * find any DB rows that are still 'scheduled'/'processing'/'requeued' but
 * have no matching job in BullMQ, and re-enqueue them using their row id
 * as the BullMQ jobId. Because enqueueEmailSend() is idempotent on jobId,
 * running this on every boot is always safe and never creates duplicates,
 * whether or not Redis actually lost its data.
 */
export async function recoverIncompleteJobs() {
  const { rows } = await pool.query<EmailJobRow>(
    `SELECT * FROM email_jobs WHERE status IN ('scheduled', 'processing', 'requeued')`
  );

  if (rows.length === 0) {
    console.log("[recovery] no incomplete jobs to reconcile");
    return;
  }

  let reattached = 0;
  for (const row of rows) {
    const existing = row.bullmq_job_id
      ? await emailQueue.getJob(row.bullmq_job_id)
      : null;

    if (existing) continue; // still tracked in Redis, nothing to do

    const scheduledAtMs = new Date(row.scheduled_at).getTime();
    await enqueueEmailSend(
      row.id,
      {
        emailJobId: row.id,
        senderEmail: row.sender_email,
        recipientEmail: row.recipient_email,
        subject: row.subject,
        body: row.body,
        hourlyLimitPerSender: env.maxEmailsPerHourPerSender,
        hourlyLimitGlobal: env.maxEmailsPerHour,
        minDelayMs: env.minDelayBetweenEmailsMs,
      },
      scheduledAtMs
    );

    await pool.query(
      `UPDATE email_jobs SET bullmq_job_id = $2, status = 'scheduled', updated_at = now()
       WHERE id = $1`,
      [row.id, row.id]
    );
    reattached++;
  }

  console.log(
    `[recovery] reconciled ${reattached}/${rows.length} incomplete job(s) back into the queue`
  );
}
