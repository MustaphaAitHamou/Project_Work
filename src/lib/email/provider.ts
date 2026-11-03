import "server-only";
import { createTransport, type Transporter } from "nodemailer";
import { Resend } from "resend";
import { env } from "@/lib/env";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: OutgoingEmail): Promise<{ id: string | null }>;
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("email_provider_not_configured");
  }
}

class ResendProvider implements EmailProvider {
  readonly name = "resend";
  private client: Resend;
  constructor(apiKey: string, private from: string) {
    this.client = new Resend(apiKey);
  }
  async send(m: OutgoingEmail) {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: [m.to],
      subject: m.subject,
      html: m.html,
      text: m.text,
      replyTo: m.replyTo,
    });
    if (error) throw new Error(`resend: ${error.name}: ${error.message}`);
    return { id: data?.id ?? null };
  }
}

class SmtpProvider implements EmailProvider {
  readonly name = "smtp";
  private transport: Transporter;
  constructor(private from: string) {
    const e = env();
    if (!e.SMTP_HOST) throw new EmailNotConfiguredError();
    this.transport = createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT ?? 587,
      secure: e.SMTP_SECURE,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    });
  }
  async send(m: OutgoingEmail) {
    const info = await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, html: m.html, text: m.text, replyTo: m.replyTo });
    return { id: info.messageId ?? null };
  }
}

let provider: EmailProvider | null | undefined;

/** Returns the configured provider, or null when e-mail delivery is not configured. */
export function getEmailProvider(): EmailProvider | null {
  if (provider !== undefined) return provider;
  const e = env();
  if (e.EMAIL_PROVIDER === "resend" && e.RESEND_API_KEY) provider = new ResendProvider(e.RESEND_API_KEY, e.EMAIL_FROM);
  else if (e.EMAIL_PROVIDER === "smtp" && e.SMTP_HOST) provider = new SmtpProvider(e.EMAIL_FROM);
  else provider = null;
  return provider;
}

/** Test hook. */
export function setEmailProviderForTests(p: EmailProvider | null) {
  provider = p;
}
