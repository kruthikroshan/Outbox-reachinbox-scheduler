export type EmailStatus =
  | "scheduled"
  | "processing"
  | "sent"
  | "failed"
  | "requeued";

export interface EmailJobRow {
  id: string;
  campaign_id: string | null;
  user_id: string | null;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduled_at: string;
  sent_at: string | null;
  bullmq_job_id: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailJobPayload {
  emailJobId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  hourlyLimitPerSender: number;
  hourlyLimitGlobal: number;
  minDelayMs: number;
}

export interface ScheduleRequestBody {
  subject: string;
  body: string;
  senderEmail: string;
  recipients: string[];
  startTime: string; // ISO string
  delayMs?: number;
  hourlyLimit?: number;
}
