import { Router } from "express";
import { pool } from "../config/db";
import { requireAuth } from "../middleware/requireAuth";
import { enqueueEmailSend } from "../queues/emailQueue";
import { env } from "../config/env";
import { ScheduleRequestBody } from "../types";
import { searchEmailJobs, elasticsearchEnabled } from "../services/elasticsearchClient";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/schedule", requireAuth, async (req, res) => {
  const body = req.body as ScheduleRequestBody;

  if (!body.subject || !body.body || !body.senderEmail || !body.startTime) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const recipients = (body.recipients || []).filter((r) => EMAIL_RE.test(r));
  if (recipients.length === 0) {
    return res.status(400).json({ error: "No valid recipient email addresses" });
  }

  const delayMs = body.delayMs ?? env.minDelayBetweenEmailsMs;
  const hourlyLimit = body.hourlyLimit ?? env.maxEmailsPerHourPerSender;
  const startTimeMs = new Date(body.startTime).getTime();
  if (Number.isNaN(startTimeMs)) {
    return res.status(400).json({ error: "Invalid startTime" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const campaignResult = await client.query(
      `INSERT INTO campaigns (user_id, subject, body, sender_email, delay_ms, hourly_limit, start_time)
       VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
       RETURNING id`,
      [
        req.user!.id,
        body.subject,
        body.body,
        body.senderEmail,
        delayMs,
        hourlyLimit,
        startTimeMs,
      ]
    );
    const campaignId = campaignResult.rows[0].id;

    const created: { id: string; recipient: string; scheduledAt: string }[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const scheduledAtMs = startTimeMs + i * delayMs;
      const jobRow = await client.query(
        `INSERT INTO email_jobs
           (campaign_id, user_id, sender_email, recipient_email, subject, body, status, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', to_timestamp($7 / 1000.0))
         RETURNING id, scheduled_at`,
        [
          campaignId,
          req.user!.id,
          body.senderEmail,
          recipients[i],
          body.subject,
          body.body,
          scheduledAtMs,
        ]
      );
      const emailJobId = jobRow.rows[0].id;

      await enqueueEmailSend(
        emailJobId,
        {
          emailJobId,
          senderEmail: body.senderEmail,
          recipientEmail: recipients[i],
          subject: body.subject,
          body: body.body,
          hourlyLimitPerSender: hourlyLimit,
          hourlyLimitGlobal: env.maxEmailsPerHour,
          minDelayMs: delayMs,
        },
        scheduledAtMs
      );

      await client.query(
        `UPDATE email_jobs SET bullmq_job_id = $1 WHERE id = $1`,
        [emailJobId]
      );

      created.push({
        id: emailJobId,
        recipient: recipients[i],
        scheduledAt: jobRow.rows[0].scheduled_at,
      });
    }

    await client.query("COMMIT");
    res.status(201).json({ campaignId, jobsCreated: created.length, jobs: created });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[emails/schedule] error:", err);
    res.status(500).json({ error: "Failed to schedule emails" });
  } finally {
    client.release();
  }
});

router.get("/scheduled", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user!.email === "admin@reachinbox.test";
    const query = isAdmin
      ? `SELECT * FROM email_jobs WHERE status IN ('scheduled', 'processing', 'requeued') ORDER BY scheduled_at ASC`
      : `SELECT * FROM email_jobs WHERE user_id = $1 AND status IN ('scheduled', 'processing', 'requeued') ORDER BY scheduled_at ASC`;
    const values = isAdmin ? [] : [req.user!.id];
    
    const { rows } = await pool.query(query, values);
    res.json({ emails: rows });
  } catch (err) {
    console.error("Scheduled route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/sent", requireAuth, async (req, res) => {
  try {
    const isAdmin = req.user!.email === "admin@reachinbox.test";
    const query = isAdmin
      ? `SELECT * FROM email_jobs WHERE status IN ('sent', 'failed') ORDER BY COALESCE(sent_at, updated_at) DESC`
      : `SELECT * FROM email_jobs WHERE user_id = $1 AND status IN ('sent', 'failed') ORDER BY COALESCE(sent_at, updated_at) DESC`;
    const values = isAdmin ? [] : [req.user!.id];

    const { rows } = await pool.query(query, values);
    res.json({ emails: rows });
  } catch (err) {
    console.error("Sent route error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/search", requireAuth, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ results: [], engine: "none" });

  if (elasticsearchEnabled) {
    const results = await searchEmailJobs(q);
    return res.json({ results, engine: "elasticsearch" });
  }

  // Fallback so search still works end-to-end without ES configured.
  const { rows } = await pool.query(
    `SELECT * FROM email_jobs
     WHERE user_id = $1 AND (subject ILIKE $2 OR recipient_email ILIKE $2 OR body ILIKE $2)
     ORDER BY created_at DESC LIMIT 50`,
    [req.user!.id, `%${q}%`]
  );
  res.json({ results: rows, engine: "postgres_fallback" });
});

export default router;
