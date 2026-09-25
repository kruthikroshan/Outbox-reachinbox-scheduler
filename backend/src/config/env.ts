import dotenv from "dotenv";
dotenv.config();

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: num("PORT", 4000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  sessionSecret: process.env.SESSION_SECRET || "dev_session_secret",

  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/reachinbox",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  etherealUser: process.env.ETHEREAL_USER || "",
  etherealPass: process.env.ETHEREAL_PASS || "",

  workerConcurrency: num("WORKER_CONCURRENCY", 5),
  minDelayBetweenEmailsMs: num("MIN_DELAY_BETWEEN_EMAILS_MS", 2000),
  maxEmailsPerHour: num("MAX_EMAILS_PER_HOUR", 200),
  maxEmailsPerHourPerSender: num("MAX_EMAILS_PER_HOUR_PER_SENDER", 50),

  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl:
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:4000/api/auth/google/callback",

  slackClientId: process.env.SLACK_CLIENT_ID || "",
  slackClientSecret: process.env.SLACK_CLIENT_SECRET || "",
  slackRedirectUri:
    process.env.SLACK_REDIRECT_URI ||
    "http://localhost:4000/api/slack/oauth/callback",

  elasticsearchUrl: process.env.ELASTICSEARCH_URL || "",
};
