import { Router } from "express";
import { env } from "../config/env";
import { pool } from "../config/db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const slackEnabled = !!(env.slackClientId && env.slackClientSecret);

// Step 1: dashboard's "Connect Slack" button hits this — redirects the
// user to Slack's real OAuth authorize screen. `state` carries our user id
// so we know who to attach the resulting webhook to in the callback.
router.get("/oauth/authorize", requireAuth, async (req, res) => {
  if (!slackEnabled) {
    // Mock Slack integration for local dev
    try {
      await pool.query(
        `INSERT INTO slack_integrations (user_id, team_id, team_name, webhook_url, access_token)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE
           SET team_id = EXCLUDED.team_id,
               team_name = EXCLUDED.team_name,
               webhook_url = EXCLUDED.webhook_url,
               access_token = EXCLUDED.access_token`,
        [req.user!.id, "MOCK_TEAM", "Mock Slack Workspace", "https://hooks.slack.com/services/mock", "mock-token"]
      );
      return res.redirect(`${env.frontendUrl}/dashboard?slack=connected`);
    } catch (err) {
      console.error("[slack mock] error:", err);
      return res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
    }
  }
  const params = new URLSearchParams({
    client_id: env.slackClientId,
    scope: "incoming-webhook",
    redirect_uri: env.slackRedirectUri,
    state: req.user!.id,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
});

// Step 2: Slack redirects back here with a `code`. We exchange it for an
// access token + incoming webhook URL, and persist it per user.
router.get("/oauth/callback", async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };
  if (!code || !state) {
    return res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
  }

  try {
    const params = new URLSearchParams({
      client_id: env.slackClientId,
      client_secret: env.slackClientSecret,
      code,
      redirect_uri: env.slackRedirectUri,
    });
    const resp = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = (await resp.json()) as any;

    if (!data.ok) {
      console.error("[slack oauth] exchange failed:", data.error);
      return res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
    }

    const webhookUrl = data.incoming_webhook?.url;
    const teamId = data.team?.id;
    const teamName = data.team?.name;

    await pool.query(
      `INSERT INTO slack_integrations (user_id, team_id, team_name, webhook_url, access_token)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
         SET team_id = EXCLUDED.team_id,
             team_name = EXCLUDED.team_name,
             webhook_url = EXCLUDED.webhook_url,
             access_token = EXCLUDED.access_token`,
      [state, teamId, teamName, webhookUrl, data.access_token]
    );

    res.redirect(`${env.frontendUrl}/dashboard?slack=connected`);
  } catch (err) {
    console.error("[slack oauth] callback error:", err);
    res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
  }
});

router.get("/status", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT team_name, created_at FROM slack_integrations WHERE user_id = $1`,
    [req.user!.id]
  );
  res.json({ connected: rows.length > 0, team: rows[0]?.team_name ?? null });
});

router.post("/disconnect", requireAuth, async (req, res) => {
  await pool.query(`DELETE FROM slack_integrations WHERE user_id = $1`, [
    req.user!.id,
  ]);
  res.json({ ok: true });
});

export default router;
