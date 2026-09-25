import { pool } from "../config/db";

/**
 * Sends a live Slack message the moment a sender's hourly rate limit is hit.
 * Looks up the user's stored incoming-webhook URL (captured during the real
 * Slack OAuth flow, see routes/slack.ts). If the user never connected Slack,
 * this silently no-ops (no crash, no notification) per spec. If they connect
 * later, notifications start working immediately on the next hit — no
 * redeploy needed, since we look the webhook up fresh on every call.
 */
export async function notifySlackRateLimitHit(params: {
  userId: string | null;
  senderEmail: string;
  limitType: "global" | "per-sender";
  limitValue: number;
}): Promise<void> {
  if (!params.userId) return;

  const { rows } = await pool.query(
    `SELECT webhook_url FROM slack_integrations WHERE user_id = $1 LIMIT 1`,
    [params.userId]
  );
  const webhookUrl = rows[0]?.webhook_url as string | undefined;
  if (!webhookUrl) return; // not connected -> no-op, per spec

  const text =
    `:warning: *Rate limit hit* — sender \`${params.senderEmail}\` reached its ` +
    `${params.limitType} hourly limit (${params.limitValue}/hr). ` +
    `Remaining emails have been rescheduled into the next hour window.`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error(
        `[slack] webhook post failed: ${res.status} ${await res.text()}`
      );
    }
  } catch (err) {
    console.error("[slack] failed to notify:", err);
  }
}
