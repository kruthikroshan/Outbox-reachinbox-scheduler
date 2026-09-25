export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export type EmailStatus =
  | "scheduled"
  | "processing"
  | "sent"
  | "failed"
  | "requeued";

export interface EmailJob {
  id: string;
  campaign_id: string | null;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduled_at: string;
  sent_at: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleFormValues {
  subject: string;
  body: string;
  senderEmail: string;
  recipients: string[];
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
}
