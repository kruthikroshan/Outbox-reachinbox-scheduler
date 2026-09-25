# ReachInbox — Full-stack Email Job Scheduler

**🔴 Live Demo:** [https://outbox-reachinbox-scheduler.vercel.app/](https://outbox-reachinbox-scheduler.vercel.app/)

> **Reviewer Note:** To test the application, click **Admin Login** on the frontend to access the BullMQ dashboards, or use **Continue with Google** (which currently uses a mock OAuth flow for grading purposes) to access the standard user dashboard.

A production-shaped slice of ReachInbox's send pipeline: schedule cold
emails via API, fan them out through BullMQ delayed jobs (no cron), throttle
and rate-limit them like a real provider, survive restarts without losing or
duplicating a send, and watch it all from a dashboard.

```text
reachinbox-scheduler/
├── backend/     Express + TypeScript API, BullMQ worker, Postgres, Redis
├── frontend/    Next.js + Tailwind dashboard
└── docker-compose.yml
```

---

## 📸 Project Screenshots

| User Dashboard | Admin BullMQ Dashboard |
| :---: | :---: |
| ![User Dashboard](screenshots/user_dashboard_v2.png) <br/> *Standard users can schedule and monitor their own campaigns.* | ![Admin Dashboard](screenshots/admin_dashboard.png) <br/> *Admins get live visibility into background workers and queues.* |

---

## 🛠 Setup Instructions

### Live Cloud Deployment (Recommended for Testing)
The application is fully containerized and deployed live:
- **Frontend:** Vercel
- **Backend:** Render (Docker)
- **Database:** Render PostgreSQL
- **Cache/Queues:** Render Redis

### Local Setup (Docker)

```bash
# Clone the repository
git clone https://github.com/kruthikroshan/Outbox-reachinbox-scheduler.git
cd Outbox-reachinbox-scheduler

# Setup Environment Variables
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local

# Boot the entire stack (Postgres, Redis, Elasticsearch, Backend, Frontend)
docker compose up --build
```
*Note: Run `docker compose exec backend npm run migrate` to initialize local databases.*

---

## 🏗 Architecture Details

### Tech Stack
- **Frontend:** Next.js 14, React, TailwindCSS, Axios
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL (Source of truth)
- **Message Broker / Cache:** Redis + BullMQ (For delayed job processing)
- **Search (Optional):** Elasticsearch
- **Email Delivery:** Ethereal SMTP (Nodemailer)

### How scheduling works
- A schedule request (`POST /api/emails/schedule`) creates one `campaigns` row and one `email_jobs` row per recipient in Postgres, then calls `enqueueEmailSend()` for each row.
- `enqueueEmailSend` adds a **BullMQ delayed job** (`queues/emailQueue.ts`) with `delay = scheduledAt - now`. Each recipient's `scheduledAt` is `startTime + index * delayMs`, so the configured inter-email delay is baked into the schedule itself, not just enforced at send time.
- **No cron anywhere.** BullMQ's delayed job set (a Redis sorted set) is the only scheduling primitive; a `Worker` (`queues/emailWorker.ts`) picks jobs up as their delay elapses.

### How persistence on restart is handled
1. **Primary:** BullMQ stores every job (waiting, delayed, active) in Redis itself, independent of the Node process. A plain restart resumes exactly where it left off — nothing to do.
2. **Reconciliation (`bootstrap/recoverJobs.ts`, runs on every boot):** Covers the harder case where Redis itself lost its data. It queries Postgres for any `email_jobs` row still `scheduled` / `processing` / `requeued` with no matching job in BullMQ, and re-enqueues it.

---

## ✨ Feature Implementation

**Frontend Features**
- **Real-Time UI:** Live toast notifications and 5s polling for up-to-the-second email statuses.
- **Role-Based UI:** Conditional rendering of Admin controls based on the active user session.
- **Advanced Compose Modal:** Subject, body, sender configuration, CSV/txt lead upload with detected-address count, start time, delay injection, and hourly limit configurations.
- **Slack Integration:** 1-click connect/disconnect directly from the dashboard header.

**Backend Features**
- **Configurable Rate Limiting:** Global + per-sender hourly rate limits using Redis atomic Lua scripts (multi-worker safe).
- **Smart Requeuing:** Rate-limited jobs are elegantly pushed into the next hour window (never dropped).
- **Live Slack Notifications:** Real OAuth flow and live webhook notifications fired the exact millisecond a rate-limit is hit.
- **Elasticsearch:** Indexing + search with graceful fallback to Postgres `ILIKE` if ES is unavailable.
- **Ethereal SMTP Integration:** Auto-provisioned test account via nodemailer for immediate testing out of the box.

---

## 👥 Roles & Access Control

The platform implements Role-Based Access Control (RBAC) to separate standard scheduling tasks from system administration.

### 1. Standard User
- **Access Level:** Private / Isolated
- **Capabilities:**
  - Can only view and manage their *own* scheduled emails and campaigns.
  - Can connect their own Slack account for personalized rate-limit notifications.
  - Can upload leads and dispatch email jobs securely.

### 2. System Admin (`admin@reachinbox.test`)
- **Access Level:** Global
- **Capabilities:**
  - **Global Visibility:** Bypasses standard isolation to view *all* scheduled and sent emails across the entire platform.
  - **BullMQ Admin Panel:** Gets exclusive access to the `System Admin Panel` button in the header, which routes to a live BullMQ instance (`/admin/queues`).
  - **Queue Control:** Can actively monitor, pause, resume, and retry failed background jobs for all users in real-time.

---



## 4. Environment variables

See `backend/.env.example` and `frontend/.env.local.example` for the full,
commented list. Notably:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — create at
  console.cloud.google.com (OAuth consent screen + Web application
  credentials, authorized redirect URI
  `http://localhost:4000/api/auth/google/callback`). Without these, the
  login button returns a clear 501 instead of failing silently.
- `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` — create a Slack app at
  api.slack.com/apps with the `incoming-webhook` OAuth scope and redirect
  URI `http://localhost:4000/api/slack/oauth/callback`.
- `ETHEREAL_USER` / `ETHEREAL_PASS` — optional; leave blank for
  auto-provisioning.
- `ELASTICSEARCH_URL` — optional; omit to use the Postgres fallback.

---

## 5. Assumptions, shortcuts & trade-offs

- Auth uses a signed JWT in an httpOnly cookie rather than server-side
  sessions — simpler to run without a session store, same security
  properties for this scope.
- CSV/lead parsing happens client-side (regex-extract email addresses from
  the uploaded file) rather than a separate upload endpoint, since the spec
  only requires showing the detected count before scheduling.
- The minimum-delay throttle is enforced at the worker-pool level (BullMQ
  `limiter`) rather than a strictly per-sender token bucket; called out
  above as a documented trade-off.
- Dashboard status updates via 5s polling rather than websockets/SSE —
  simplest thing that satisfies "view scheduled/sent emails" without extra
  infra.
- `campaigns`/`email_jobs` don't implement multi-tenant sender rotation
  beyond "one sender email per campaign"; the per-sender rate limiter is
  still fully general (keyed by sender email) for when that's added.
