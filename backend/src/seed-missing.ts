import { pool } from "./config/db";
import { emailQueue } from "./queues/emailQueue";

async function seedMissing() {
  console.log("Fixing ACTIVE and PRIORITIZED mock data...");

  // Unpause to allow workers to pick up jobs
  await emailQueue.resume();

  // Get our dummy user
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE email = 'demo@reachinbox.test' LIMIT 1`
  );
  const user = rows[0];

  async function createJobRow(subject: string) {
    const { rows: emailRows } = await pool.query(
      `INSERT INTO email_jobs (user_id, sender_email, recipient_email, subject, body, status, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', now()) RETURNING *`,
      [user.id, user.email, `mock@demo.com`, subject, `Mock email.`]
    );
    return emailRows[0];
  }

  // 1. PRIORITIZED (No delay, so they go straight to the prioritized wait list)
  console.log("Adding 10 PRIORITIZED jobs...");
  for (let i = 0; i < 10; i++) {
    const row = await createJobRow(`Priority Mock ${i}`);
    await emailQueue.add("send-email", { ...row, hourlyLimitPerSender: 10, hourlyLimitGlobal: 50 }, { jobId: row.id, priority: 1 });
  }

  // 2. ACTIVE (Add long-running jobs)
  console.log("Adding 10 ACTIVE jobs...");
  for (let i = 0; i < 10; i++) {
    const row = await createJobRow(`[LONG] Active Mock ${i}`);
    await emailQueue.add("send-email", { ...row, hourlyLimitPerSender: 10, hourlyLimitGlobal: 50 }, { jobId: row.id });
  }

  console.log("Waiting 3 seconds for the backend worker to pick up the [LONG] jobs...");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Pause again so the remainder stay in the queue
  await emailQueue.pause();
  
  console.log("Done! You should now see jobs in ACTIVE and PRIORITIZED.");
  process.exit(0);
}

seedMissing().catch(console.error);
