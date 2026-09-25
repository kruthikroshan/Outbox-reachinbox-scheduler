"use client";

import { useRef, useState } from "react";
import { ScheduleFormValues } from "@/lib/types";

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

function parseRecipientsFromText(text: string): string[] {
  const found = text.match(EMAIL_RE) || [];
  return Array.from(new Set(found.map((e) => e.trim().toLowerCase())));
}

export function ComposeModal({
  defaultSenderEmail,
  onClose,
  onSubmit,
}: {
  defaultSenderEmail: string;
  onClose: () => void;
  onSubmit: (values: ScheduleFormValues) => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderEmail, setSenderEmail] = useState(defaultSenderEmail);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    setRecipients(parseRecipientsFromText(text));
    setFileName(file.name);
  }

  async function handleSubmit() {
    setError(null);
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required.");
      return;
    }
    if (recipients.length === 0) {
      setError("Upload a CSV/text file with at least one recipient email.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        subject,
        body,
        senderEmail,
        recipients,
        startTime: new Date(startTime).toISOString(),
        delayMs,
        hourlyLimit,
      });
    } catch (err: any) {
      setError(err.message || "Failed to schedule emails");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Compose new email
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Sender email
            </label>
            <input
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="you@yourcompany.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Subject
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="Quick question about {{company}}"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              placeholder="Hi there, ..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Leads (CSV or .txt of emails)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="w-full text-sm"
            />
            {fileName && (
              <p className="mt-1 text-xs text-slate-500">
                {fileName} — {recipients.length} email address
                {recipients.length === 1 ? "" : "es"} detected
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Start time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Delay (ms)
              </label>
              <input
                type="number"
                min={0}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Hourly limit
              </label>
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "Scheduling…" : "Schedule"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
