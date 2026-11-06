import { createTranslator } from "next-intl";
import fr from "../../../messages/fr.json";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import ar from "../../../messages/ar.json";
import { interpolate, renderEmail, type EmailContent, type RenderedEmail } from "./render";

const MESSAGES = { fr, en, es, ar } as const;
type Locale = keyof typeof MESSAGES;

export const EMAIL_TEMPLATES = [
  "application_submitted",
  "new_application",
  "application_status_changed",
  "job_alert_digest",
  "company_verification_result",
  "job_moderation_result",
  "job_published",
  "payment_failed",
  "job_suspended_payment",
  "job_expired",
  "account_suspended",
  "company_suspension",
  "privacy_request_update",
] as const;
export type EmailTemplate = (typeof EMAIL_TEMPLATES)[number];

export interface TemplateOverride {
  subject: string;
  body: string;
}

type Payload = Record<string, unknown>;
type Translator = ReturnType<typeof createTranslator<typeof fr, "emails">>;
type Enums = ReturnType<typeof createTranslator<typeof fr, "enums">>;

interface Ctx {
  t: Translator;
  te: Enums;
  p: Payload;
  url: (path: string) => string;
}

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

const DEFINITIONS: Record<EmailTemplate, (c: Ctx) => Omit<EmailContent, "locale" | "footer">> = {
  application_submitted: ({ t, p, url }) => ({
    subject: t("application_submitted.subject", { job: s(p.job_title) }),
    paragraphs: [t("application_submitted.body", { job: s(p.job_title), company: s(p.company_name) })],
    cta: { label: t("application_submitted.cta"), url: url("/candidate/applications") },
  }),
  new_application: ({ t, p, url }) => ({
    subject: t("new_application.subject", { job: s(p.job_title) }),
    paragraphs: [t("new_application.body", { job: s(p.job_title) })],
    cta: { label: t("new_application.cta"), url: url(`/employer/jobs/${s(p.job_id)}/applications`) },
  }),
  application_status_changed: ({ t, te, p, url }) => {
    const status = s(p.status) as "viewed" | "shortlisted" | "rejected" | "hired" | "job_closed";
    return {
      subject: t("application_status_changed.subject", { job: s(p.job_title), status: te(`applicationStatus.${status}`) }),
      paragraphs: [t(`application_status_changed.body_${status}`, { job: s(p.job_title), company: s(p.company_name) })],
      cta: { label: t("application_status_changed.cta"), url: url("/candidate/applications") },
    };
  },
  job_alert_digest: ({ t, p, url }) => {
    const jobs = (Array.isArray(p.jobs) ? p.jobs : []) as Array<{ title: string; company: string; city: string; path: string }>;
    return {
      subject: t("job_alert_digest.subject", { count: jobs.length, name: s(p.alert_name) }),
      paragraphs: [t("job_alert_digest.body", { name: s(p.alert_name) }), t("job_alert_digest.manage")],
      items: jobs.slice(0, 20).map((j) => ({ title: j.title, subtitle: [j.company, j.city].filter(Boolean).join(" · "), url: url(j.path) })),
      cta: { label: t("job_alert_digest.cta"), url: url(`/jobs${s(p.query) ? `?${s(p.query)}` : ""}`) },
    };
  },
  company_verification_result: ({ t, p, url }) => {
    const outcome = s(p.outcome) as "verified" | "rejected" | "manual_review";
    const paragraphs = [t(`company_verification_result.body_${outcome}`, { company: s(p.company_name) })];
    if (p.message) paragraphs.push(t("company_verification_result.reason", { message: s(p.message) }));
    return {
      subject: t(`company_verification_result.subject_${outcome}`, { company: s(p.company_name) }),
      paragraphs,
      cta: { label: t("company_verification_result.cta"), url: url("/employer/verification") },
    };
  },
  job_moderation_result: ({ t, p, url }) => {
    const decision = s(p.decision) as "approve" | "reject" | "suspend" | "reinstate";
    const paragraphs = [t(`job_moderation_result.body_${decision}`, { job: s(p.job_title) })];
    if (p.reason) paragraphs.push(t("job_moderation_result.reason", { reason: s(p.reason) }));
    return {
      subject: t(`job_moderation_result.subject_${decision}`, { job: s(p.job_title) }),
      paragraphs,
      cta: { label: t("job_moderation_result.cta"), url: url(`/employer/jobs/${s(p.job_id)}`) },
    };
  },
  job_published: ({ t, p, url }) => ({
    subject: t("job_published.subject", { job: s(p.job_title) }),
    paragraphs: [t("job_published.body", { job: s(p.job_title) })],
    cta: { label: t("job_published.cta"), url: url(`/jobs/${s(p.job_path)}`) },
  }),
  payment_failed: ({ t, p, url }) => ({
    subject: t("payment_failed.subject", { job: s(p.job_title) }),
    paragraphs: [t("payment_failed.body", { job: s(p.job_title), days: Number(p.grace_days ?? 3) })],
    cta: { label: t("payment_failed.cta"), url: url("/employer/billing") },
  }),
  job_suspended_payment: ({ t, p, url }) => ({
    subject: t("job_suspended_payment.subject", { job: s(p.job_title) }),
    paragraphs: [t("job_suspended_payment.body", { job: s(p.job_title) })],
    cta: { label: t("job_suspended_payment.cta"), url: url("/employer/billing") },
  }),
  job_expired: ({ t, p, url }) => ({
    subject: t("job_expired.subject", { job: s(p.job_title) }),
    paragraphs: [t("job_expired.body", { job: s(p.job_title) })],
    cta: { label: t("job_expired.cta"), url: url("/employer/jobs") },
  }),
  account_suspended: ({ t, p }) => ({
    subject: t("account_suspended.subject"),
    paragraphs: [t("account_suspended.body"), ...(p.reason ? [t("account_suspended.reason", { reason: s(p.reason) })] : [])],
  }),
  company_suspension: ({ t, p, url }) => {
    const suspended = p.suspended === true;
    const company = s(p.company_name);
    return {
      subject: suspended ? t("company_suspension.subjectSuspended", { company }) : t("company_suspension.subjectReinstated", { company }),
      paragraphs: suspended
        ? [t("company_suspension.suspended"), ...(p.reason ? [t("company_suspension.reason", { reason: s(p.reason) })] : [])]
        : [t("company_suspension.reinstated")],
      cta: { label: t("company_suspension.cta"), url: url("/employer") },
    };
  },
  privacy_request_update: ({ t, te, p, url }) => ({
    subject: t("privacy_request_update.subject"),
    paragraphs: [
      t("privacy_request_update.body", {
        type: te(`privacyRequestType.${s(p.type) as "export"}`),
        status: te(`privacyRequestStatus.${s(p.status) as "completed"}`),
      }),
      ...(p.response ? [s(p.response)] : []),
    ],
    cta: { label: t("privacy_request_update.cta"), url: url("/candidate/privacy") },
  }),
};

export function isEmailTemplate(name: string): name is EmailTemplate {
  return (EMAIL_TEMPLATES as readonly string[]).includes(name);
}

export function buildEmail(
  template: EmailTemplate,
  localeInput: string,
  payload: Payload,
  opts: { siteUrl: string; firstName?: string | null; override?: TemplateOverride | null },
): RenderedEmail {
  const locale: Locale = (localeInput in MESSAGES ? localeInput : "fr") as Locale;
  const messages = MESSAGES[locale] as typeof fr;
  const t = createTranslator({ locale, messages, namespace: "emails" });
  const te = createTranslator({ locale, messages, namespace: "enums" });
  const url = (path: string) => new URL(`/${locale}${path.startsWith("/") ? path : `/${path}`}`, opts.siteUrl).toString();
  const def = DEFINITIONS[template]({ t, te, p: payload, url });
  const greeting = opts.firstName ? t("greeting", { name: opts.firstName }) : t("greetingNoName");

  let subject = def.subject;
  let paragraphs = def.paragraphs;
  if (opts.override) {
    const vars: Payload = { ...payload, first_name: opts.firstName ?? "", site_url: opts.siteUrl };
    subject = interpolate(opts.override.subject, vars, false).trim() || subject;
    paragraphs = interpolate(opts.override.body, vars, false)
      .split(/\n{2,}/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return renderEmail({
    locale,
    subject,
    paragraphs: [greeting, ...paragraphs],
    items: def.items,
    cta: def.cta,
    footer: t("footer"),
  });
}
