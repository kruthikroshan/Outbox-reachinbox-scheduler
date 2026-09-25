"use client";

import { api } from "@/lib/api";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
          R
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">
          ReachInbox Scheduler
        </h1>
        <p className="max-w-sm text-sm text-slate-500">
          Schedule, throttle, and track cold email sends — backed by BullMQ,
          Redis, and Postgres.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-[240px]">
        <a
          href={api.googleLoginUrl()}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z"
            />
          </svg>
          Continue with Google
        </a>

        <a
          href={api.adminLoginUrl()}
          className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
          Admin Login
        </a>
      </div>

      <p className="max-w-xs text-center text-xs text-slate-400">
        Uses real Google OAuth. If the button errors, the server admin still
        needs to set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
      </p>
    </main>
  );
}
