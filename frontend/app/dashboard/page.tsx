"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { EmailJob, ScheduleFormValues, User } from "@/lib/types";
import { Header } from "@/components/Header";
import { ScheduledTable, SentTable } from "@/components/EmailTables";
import { ComposeModal } from "@/components/ComposeModal";
import { Toast } from "@/components/ui";
import { toast as hotToast } from "react-hot-toast";
import { useRef } from "react";
type Tab = "scheduled" | "sent";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [tab, setTab] = useState<Tab>("scheduled");
  const [scheduled, setScheduled] = useState<EmailJob[]>([]);
  const [sent, setSent] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    variant: "error" | "success";
  } | null>(null);

  const prevSentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => router.replace("/"))
      .finally(() => setAuthChecked(true));
  }, [router]);

  useEffect(() => {
    if (!user) return;
    api
      .slackStatus()
      .then((res) => setSlackConnected(res.connected))
      .catch(() => setSlackConnected(false));
  }, [user]);

  async function refresh() {
    setLoading(true);
    try {
      const [s, se] = await Promise.all([api.scheduled(), api.sent()]);
      setScheduled(s.emails);
      setSent(se.emails);

      // Check for newly sent emails to trigger real notifications
      const currentSentIds = new Set(se.emails.map(e => e.id));
      if (prevSentRef.current.size > 0) {
        se.emails.forEach(email => {
          if (!prevSentRef.current.has(email.id)) {
            if (email.status === "sent") {
              hotToast.success(`Email successfully sent to ${email.recipient_email}!`);
            } else if (email.status === "failed") {
              hotToast.error(`Failed to send email to ${email.recipient_email}`);
            }
          }
        });
      }
      prevSentRef.current = currentSentIds;

    } catch (err: any) {
      setToast({ message: err.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    refresh();
    // Poll for live status changes (queue -> processing -> sent) without
    // needing websockets for this assignment's scope.
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleScheduleSubmit(values: ScheduleFormValues) {
    const res = await api.scheduleEmails(values);
    hotToast.success(`Scheduled ${res.jobsCreated} email(s).`);
    setComposeOpen(false);
    refresh();
  }

  async function handleLogout() {
    await api.logout();
    router.replace("/");
  }

  if (!authChecked) {
    return <div className="flex min-h-screen items-center justify-center" />;
  }
  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Header
        user={user}
        slackConnected={slackConnected}
        onLogout={handleLogout}
        onCompose={() => setComposeOpen(true)}
        onSlackConnect={() => {
          window.location.href = api.slackConnectUrl();
        }}
        onSlackDisconnect={async () => {
          await api.slackDisconnect();
          setSlackConnected(false);
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium w-fit">
          {(["scheduled", "sent"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 capitalize transition ${
                tab === t
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t} emails
              {t === "scheduled" && scheduled.length > 0 && (
                <span className="ml-1.5 text-xs text-slate-400">
                  ({scheduled.length})
                </span>
              )}
              {t === "sent" && sent.length > 0 && (
                <span className="ml-1.5 text-xs text-slate-400">
                  ({sent.length})
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "scheduled" ? (
          <ScheduledTable rows={scheduled} loading={loading} />
        ) : (
          <SentTable rows={sent} loading={loading} />
        )}
      </main>

      {composeOpen && (
        <ComposeModal
          defaultSenderEmail={user.email}
          onClose={() => setComposeOpen(false)}
          onSubmit={handleScheduleSubmit}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
