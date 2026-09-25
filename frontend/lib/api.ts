import { EmailJob, ScheduleFormValues, User } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      /* ignore parse failure */
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  me: () => request<{ user: User }>("/api/auth/me"),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  googleLoginUrl: () => `${API_URL}/api/auth/google`,
  adminLoginUrl: () => `${API_URL}/api/auth/admin`,

  slackStatus: () =>
    request<{ connected: boolean; team: string | null }>("/api/slack/status"),
  slackConnectUrl: () => `${API_URL}/api/slack/oauth/authorize`,
  slackDisconnect: () =>
    request<{ ok: true }>("/api/slack/disconnect", { method: "POST" }),

  scheduleEmails: (values: ScheduleFormValues) =>
    request<{ campaignId: string; jobsCreated: number }>(
      "/api/emails/schedule",
      { method: "POST", body: JSON.stringify(values) }
    ),
  scheduled: () => request<{ emails: EmailJob[] }>("/api/emails/scheduled"),
  sent: () => request<{ emails: EmailJob[] }>("/api/emails/sent"),
  search: (q: string) =>
    request<{ results: any[]; engine: string }>(
      `/api/emails/search?q=${encodeURIComponent(q)}`
    ),
};
