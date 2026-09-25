import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Outgoing email.
 *
 * Password reset must work without any external service, and email providers
 * (Mailtrap, Resend, SMTP) are all optional here:
 *
 *  - SMTP_HOST set  -> the message is sent with nodemailer (SMTP_URL or
 *                      SMTP_HOST/PORT/USER/PASS).
 *  - otherwise      -> "dev outbox": the message is written to
 *                      <project>/.dev-outbox/ and its reset link is printed in
 *                      the server console, so the flow stays testable offline.
 *
 * The reset link is never exposed through an API response or the browser
 * console - only the server log and the outbox file (both developer surfaces).
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailResult {
  delivered: boolean;
  transport: "smtp" | "outbox";
  outboxPath?: string;
}

const OUTBOX_DIR = path.join(process.cwd(), ".dev-outbox");

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST || process.env.SMTP_URL);
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (smtpConfigured()) {
    const nodemailer = await import("nodemailer");
    const transport = process.env.SMTP_URL
      ? nodemailer.createTransport(process.env.SMTP_URL)
      : nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number.parseInt(process.env.SMTP_PORT ?? "587", 10),
          secure: process.env.SMTP_SECURE === "true",
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        });
    await transport.sendMail({
      from: process.env.MAIL_FROM ?? "Idol Spending Tracker <no-reply@localhost>",
      ...message,
    });
    return { delivered: true, transport: "smtp" };
  }

  await mkdir(OUTBOX_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTo = message.to.replace(/[^a-z0-9@._-]/gi, "_");
  const file = path.join(OUTBOX_DIR, `${stamp}__${safeTo}.txt`);
  await writeFile(
    file,
    [
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      "",
      message.text,
      message.html ? `\n\n--- html ---\n${message.html}` : "",
    ].join("\n"),
    "utf8",
  );

  console.info(`[mail] dev outbox -> ${file}`);
  console.info(`[mail] ${message.subject}\n${message.text}`);

  return { delivered: false, transport: "outbox", outboxPath: file };
}

const BRAND = "Idol Spending Tracker";

export function passwordResetMessage(to: string, resetUrl: string, ttlMinutes: number): MailMessage {
  const text = [
    `Halo,`,
    ``,
    `Kami menerima permintaan reset password untuk akun ${BRAND} kamu.`,
    `Buka link berikut untuk membuat password baru (berlaku ${ttlMinutes} menit):`,
    ``,
    resetUrl,
    ``,
    `Kalau kamu tidak meminta reset password, abaikan email ini. Password kamu tidak akan berubah.`,
    ``,
    `-- ${BRAND}`,
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e2e8f0">
    <h1 style="font-size:18px;margin:0 0 12px">Reset password</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6">Kami menerima permintaan reset password untuk akun <strong>${BRAND}</strong> kamu.</p>
    <p style="margin:24px 0">
      <a href="${resetUrl}" style="background:#6366f1;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;display:inline-block">Buat Password Baru</a>
    </p>
    <p style="color:#64748b;font-size:13px;line-height:1.6">Link berlaku ${ttlMinutes} menit dan hanya bisa dipakai sekali. Kalau kamu tidak meminta ini, abaikan saja email ini.</p>
    <p style="color:#94a3b8;font-size:12px;word-break:break-all">${resetUrl}</p>
  </div>
</body></html>`;

  return { to, subject: "Reset Password — Idol Spending Tracker", text, html };
}
