import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { emails } from "@/db/schema";

let transporter: Transporter | null = null;

export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

export type OutgoingEmail = {
  kind: string;
  relatedId?: string | null;
  to: string;
  cc?: string[];
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
};

export type SendResult = { id: string; status: "sent" | "failed" | "logged"; error?: string };

/** Records the email in the outbox, then delivers it via SMTP (or just logs it locally). */
export async function sendEmail(msg: OutgoingEmail): Promise<SendResult> {
  const cc = (msg.cc ?? []).filter((c) => c && c.toLowerCase() !== msg.to.toLowerCase());
  const [row] = await db
    .insert(emails)
    .values({
      kind: msg.kind,
      relatedId: msg.relatedId ?? null,
      to: msg.to,
      cc,
      replyTo: msg.replyTo ?? null,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      status: "queued",
    })
    .returning({ id: emails.id });
  return deliver(row.id);
}

export async function deliver(id: string): Promise<SendResult> {
  const [m] = await db.select().from(emails).where(eq(emails.id, id)).limit(1);
  if (!m) throw new Error("Email not found");
  if (m.status === "sent") return { id, status: "sent" };

  if (!smtpConfigured()) {
    await db.update(emails).set({ status: "logged", attempts: sql`${emails.attempts} + 1` }).where(eq(emails.id, id));
    console.info(`[email:logged] ${m.kind} → ${m.to}${m.cc.length ? ` (cc ${m.cc.join(", ")})` : ""}: ${m.subject}`);
    return { id, status: "logged" };
  }

  try {
    const info = await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: m.to,
      cc: m.cc.length ? m.cc : undefined,
      replyTo: m.replyTo ?? undefined,
      subject: m.subject,
      html: m.html,
      text: m.text,
    });
    await db
      .update(emails)
      .set({ status: "sent", sentAt: new Date(), providerMessageId: info.messageId ?? null, error: null, attempts: sql`${emails.attempts} + 1` })
      .where(eq(emails.id, id));
    return { id, status: "sent" };
  } catch (err) {
    const error = (err as Error).message.slice(0, 500);
    console.error(`[email:failed] ${m.kind} → ${m.to}: ${error}`);
    await db.update(emails).set({ status: "failed", error, attempts: sql`${emails.attempts} + 1` }).where(eq(emails.id, id));
    return { id, status: "failed", error };
  }
}
