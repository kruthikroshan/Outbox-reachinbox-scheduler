"use client";

import { User } from "@/lib/types";
import { api } from "@/lib/api";

export function Header({
  user,
  slackConnected,
  onLogout,
  onSlackConnect,
  onSlackDisconnect,
  onCompose,
}: {
  user: User;
  slackConnected: boolean;
  onLogout: () => void;
  onSlackConnect: () => void;
  onSlackDisconnect: () => void;
  onCompose: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          R
        </div>
        <span className="text-sm font-semibold text-slate-900">
          ReachInbox Scheduler
        </span>
      </div>

      <div className="flex items-center gap-3">
        {user.email === "admin@reachinbox.test" && (
          <a
            href="http://localhost:4000/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            System Admin Panel
          </a>
        )}

        <button
          onClick={onCompose}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
        >
          + Compose new email
        </button>

        {slackConnected ? (
          <button
            onClick={onSlackDisconnect}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
            title="Rate-limit alerts will post to this Slack workspace"
          >
            ✓ Slack connected
          </button>
        ) : (
          <button
            onClick={onSlackConnect}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Connect Slack
          </button>
        )}

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <div className="flex items-center gap-2">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
              {user.name?.[0] || "U"}
            </div>
          )}
          <div className="hidden text-xs leading-tight sm:block">
            <p className="font-medium text-slate-800">{user.name}</p>
            <p className="text-slate-400">{user.email}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

export function ensureLoggedOut() {
  return api.logout();
}
