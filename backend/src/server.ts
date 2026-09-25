import { buildApp } from "./app";
import { env } from "./config/env";
import { startEmailWorker } from "./queues/emailWorker";
import { recoverIncompleteJobs } from "./bootstrap/recoverJobs";

async function main() {
  // 1. Reconcile DB <-> Redis before accepting new traffic, so restarts
  //    never lose or duplicate an email that was already scheduled.
  await recoverIncompleteJobs();

  // 2. Start the worker (concurrency + min-delay throttling + hourly
  //    rate limiting all configured via env, see queues/emailWorker.ts).
  startEmailWorker();
  console.log(
    `[worker] started with concurrency=${env.workerConcurrency}, ` +
      `minDelay=${env.minDelayBetweenEmailsMs}ms, ` +
      `maxPerHour(global)=${env.maxEmailsPerHour}, ` +
      `maxPerHour(sender)=${env.maxEmailsPerHourPerSender}`
  );

  // 3. Start the API + live BullMQ dashboard.
  const app = buildApp();
  app.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
    console.log(
      `[server] BullMQ live dashboard: http://localhost:${env.port}/admin/queues`
    );
  });
}

main().catch((err) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
