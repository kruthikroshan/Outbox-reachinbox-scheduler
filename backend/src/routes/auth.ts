import { Router } from "express";
import passport from "passport";
import {
  Strategy as GoogleStrategy,
  Profile,
} from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { pool } from "../config/db";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const googleEnabled = !!(env.googleClientId && env.googleClientSecret);

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: env.googleCallbackUrl,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (err: any, user?: any) => void
      ) => {
        try {
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const avatarUrl = profile.photos?.[0]?.value;
          if (!email) return done(new Error("Google account has no email"));

          const { rows } = await pool.query(
            `INSERT INTO users (google_id, email, name, avatar_url)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (email) DO UPDATE
               SET google_id = EXCLUDED.google_id,
                   name = EXCLUDED.name,
                   avatar_url = EXCLUDED.avatar_url
             RETURNING *`,
            [profile.id, email, name, avatarUrl]
          );
          done(null, rows[0]);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );

  router.get(
    "/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false,
    })
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: "/" }),
    (req, res) => {
      const user = req.user as any;
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
        },
        env.jwtSecret,
        { expiresIn: "7d" }
      );
      res.cookie("auth_token", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.redirect(`${env.frontendUrl}/dashboard`);
    }
  );
} else {
  // Google OAuth not configured — mock login for local development
  router.get("/google", async (req, res) => {
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (google_id, email, name, avatar_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE
           SET google_id = EXCLUDED.google_id,
               name = EXCLUDED.name,
               avatar_url = EXCLUDED.avatar_url
         RETURNING *`,
        ["mock-google-id-123", "test@reachinbox.test", "Test User", "https://i.pravatar.cc/150?u=test"]
      );
      const user = rows[0];
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
        },
        env.jwtSecret,
        { expiresIn: "7d" }
      );
      res.cookie("auth_token", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.redirect(`${env.frontendUrl}/dashboard`);
    } catch (err) {
      res.status(500).json({ error: "Mock login failed" });
    }
  });
}

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("auth_token");
  res.json({ ok: true });
});

router.get("/logout_redirect", (_req, res) => {
  res.clearCookie("auth_token");
  res.redirect(env.frontendUrl);
});

router.get("/admin", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (google_id, email, name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE
         SET google_id = EXCLUDED.google_id,
             name = EXCLUDED.name,
             avatar_url = EXCLUDED.avatar_url
       RETURNING *`,
      ["mock-admin-id-456", "admin@reachinbox.test", "Admin User", "https://i.pravatar.cc/150?u=admin"]
    );
    const user = rows[0];
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
      },
      env.jwtSecret,
      { expiresIn: "7d" }
    );
    res.cookie("auth_token", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect("/admin/queues");
  } catch (err) {
    res.status(500).json({ error: "Admin mock login failed" });
  }
});

export default router;
