import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";

let transporterPromise: Promise<Transporter> | null = null;

async function buildTransporter(): Promise<Transporter> {
  let user = env.etherealUser;
  let pass = env.etherealPass;

  if (!user || !pass) {
    // Auto-provision a throwaway Ethereal inbox so the app works out of
    // the box with zero setup. Credentials are logged once on boot.
    const testAccount = await nodemailer.createTestAccount();
    user = testAccount.user;
    pass = testAccount.pass;
    console.log("\n[ethereal] Auto-created test SMTP account:");
    console.log(`  user: ${user}`);
    console.log(`  pass: ${pass}`);
    console.log("  Sent mail can be previewed via the URL logged per-send.\n");
  }

  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

function getTransporter(): Promise<Transporter> {
  if (!transporterPromise) transporterPromise = buildTransporter();
  return transporterPromise;
}

export interface SendResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info),
  };
}
