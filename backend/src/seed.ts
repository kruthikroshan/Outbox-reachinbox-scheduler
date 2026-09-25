import { FlowProducer } from "bullmq";
import { pool } from "./config/db";
import { redisConnection } from "./config/redis";
import { enqueueEmailSend, emailQueue, EMAIL_QUEUE_NAME } from "./queues/emailQueue";
import { v4 as uuidv4 } from "uuid";

async function seed() {
  console.log("Seeding massive mock data for all Bull Dashboard sections...");

  const flowProducer = new FlowProducer({ connection: redisConnection });

  // 1. Create a dummy user
  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    ["mock-data-user-999", "demo@reachinbox.test", "Demo Account", "https://i.pravatar.cc/150?u=demo"]
  );
  const user = rows[0];

  // Helper to create DB row
  async function createJobRow(subject: string, status: string, scheduledAt: Date) {
    const { rows: emailRows } = await pool.query(
      `INSERT INTO email_jobs (user_id, sender_email, recipient_email, subject, body, status, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user.id, user.email, `mock@demo.com`, subject, `Mock email.`, status, scheduledAt]
    );
    return emailRows[0];
  }

  // 1. FAILED (10 items)
  console.log("Adding 10 FAILED jobs...");
  for (let i = 0; i < 10; i++) {
    const row = await createJobRow(`[FAIL] Mock Failure ${i}`, "scheduled", new Date());
    await emailQueue.add("send-email", { ...row, hourlyLimitPerSender: 10, hourlyLimitGlobal: 50 }, { jobId: row.id, attempts: 1 });
  }

  // 2. DELAYED (10 items)
  console.log("Adding 10 DELAYED jobs...");
  for (let i = 0; i < 10; i++) {
    const row = await createJobRow(`Delayed Mock ${i}`, "scheduled", new Date(Date.now() + 60 * 60 * 1000));
    await emailQueue.add("send-email", { ...row, hourlyLimitPerSender: 10, hourlyLimitGlobal: 50 }, { jobId: row.id, delay: 60 * 60 * 1000 });
  }

  // 3. PRIORITIZED (10 items)
  console.log("Adding 10 PRIORITIZED jobs (delayed slightly so they show)...");
  for (let i = 0; i < 10; i++) {
    const row = await createJobRow(`Priority Mock ${i}`, "scheduled", new Date());
    await emailQueue.add("send-email", { ...row, hourlyLimitPerSender: 10, hourlyLimitGlobal: 50 }, { jobId: row.id, priority: 1, delay: 120000 });
  }

  // 4. WAITING CHILDREN (10 items using FlowProducer)
  console.log("Adding 10 WAITING CHILDREN jobs...");
  for (let i = 0; i < 10; i++) {
    const parentId = uuidv4();
    const childId = uuidv4();
    await flowProducer.add({
      name: "send-email",
      queueName: EMAIL_QUEUE_NAME,
      data: { subject: `Parent flow ${i}` },
      opts: { jobId: parentId },
      children: [
        {
          name: "send-email",
          queueName: EMAIL_QUEUE_NAME,
          data: { subject: `Child flow ${i}` },
          opts: { jobId: childId, delay: 3600000 }, // Delay child so parent stays waiting
        }
      ]
    });
  }

  // 5. PAUSED (Pause the queue so the next jobs stack up in PAUSED/WAITING)
  console.log("Pausing queue to simulate PAUSED section...");
  await emailQueue.pause();

  // 6. COMPLETED (We can't easily force completed without workers running, but we already have some or we let normal workers process before pausing)
  // We'll let the user unpause it later, or they can just see them in PAUSED/WAITING

  console.log("Adding 20 ACTIVE/WAITING jobs...");
  for (let i = 0; i < 20; i++) {
    const row = await createJobRow(`[LONG] Mock Active/Wait ${i}`, "scheduled", new Date());
    await emailQueue.add("send-email", { ...row, hourlyLimitPerSender: 10, hourlyLimitGlobal: 50 }, { jobId: row.id });
  }

  // Resume immediately so some become ACTIVE, some stay WAITING
  console.log("Resuming queue...");
  await emailQueue.resume();

  // 7. Pause the queue again after a tiny delay so we catch some in PAUSED state
  setTimeout(async () => {
    await emailQueue.pause();
    console.log("Seeding complete! Queue is currently PAUSED to preserve states. You can unpause it from the Bull Dashboard.");
    process.exit(0);
  }, 2000);
}

seed().catch((err) => {
  console.error("Seeding failed", err);
  process.exit(1);
});
