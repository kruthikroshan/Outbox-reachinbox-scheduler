import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { env } from "./config/env";
import { emailQueue } from "./queues/emailQueue";
import authRoutes from "./routes/auth";
import slackRoutes from "./routes/slack";
import emailRoutes from "./routes/emails";
import { requireAuth } from "./middleware/requireAuth";
export function buildApp() {
  const app = express();

  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(passport.initialize());

  // --- Live BullMQ dashboard for real-time queue visibility ---
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: "System Admin Panel",
        miscLinks: [
          { text: "← Back to App", url: `${env.frontendUrl}/dashboard` },
          { text: "Logout", url: "/api/auth/logout_redirect" }
        ]
      }
    }
  });
  app.use("/admin/queues", requireAuth, serverAdapter.getRouter());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/slack", slackRoutes);
  app.use("/api/emails", emailRoutes);

  return app;
}
