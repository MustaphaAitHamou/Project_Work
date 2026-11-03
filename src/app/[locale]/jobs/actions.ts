"use server";

import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorKey } from "@/lib/errors";
import { flushOutboxQuietly } from "@/lib/email/outbox";
import { rateLimit } from "@/lib/security/rate-limit";
import { ipKey } from "@/lib/security/request";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { REPORT_REASONS } from "@/lib/domain";
import { failure, success, type ActionState } from "@/lib/action-state";
import { routing } from "@/i18n/routing";

const uuid = z.uuid();
const loc = (l: string) => ((routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale);

export interface ApplyResult {
  ok: boolean;
  result?: "created" | "already_applied";
  applicationId?: string;
  error?: string;
  message?: string;
  missing?: string[];
}

async function apply(jobId: string, locale: string): Promise<ApplyResult> {
  const t = await getTranslations({ locale: loc(locale), namespace: "errors" });
  if (!uuid.safeParse(jobId).success) return { ok: false, error: "invalid_input", message: t("invalid_input") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_to_job", { p_job_id: jobId });
  if (error) {
    const key = errorKey(error);
    let missing: string[] | undefined;
    if (key === "profile_incomplete" && error.details) {
      try {
        missing = JSON.parse(error.details) as string[];
      } catch {
        missing = undefined;
      }
    }
    return { ok: false, error: key, message: t(key), missing };
  }
  const res = data as { result: "created" | "already_applied"; application_id: string };
  if (res.result === "created") after(flushOutboxQuietly);
  return { ok: true, result: res.result, applicationId: res.application_id };
}

/** One click: everything is checked atomically in public.apply_to_job(). */
export async function applyAction(jobId: string, locale: string): Promise<ApplyResult> {
  return apply(jobId, locale);
}

/** First application only: records the data-transmission acknowledgement, then applies. */
export async function consentAndApplyAction(jobId: string, consentVersion: string, locale: string): Promise<ApplyResult> {
  const t = await getTranslations({ locale: loc(locale), namespace: "errors" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("give_transmission_consent", { p_version: consentVersion });
  if (error) {
    const key = errorKey(error);
    return { ok: false, error: key, message: t(key) };
  }
  return apply(jobId, locale);
}

export async function toggleSavedJobAction(jobId: string, save: boolean, locale: string): Promise<{ ok: boolean; message?: string }> {
  const t = await getTranslations({ locale: loc(locale), namespace: "errors" });
  if (!uuid.safeParse(jobId).success) return { ok: false, message: t("invalid_input") };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { ok: false, message: t("not_authenticated") };
  const { error } = save
    ? await supabase.from("saved_jobs").upsert({ user_id: userId, job_id: jobId }, { onConflict: "user_id,job_id", ignoreDuplicates: true })
    : await supabase.from("saved_jobs").delete().eq("user_id", userId).eq("job_id", jobId);
  if (error) return { ok: false, message: t(errorKey(error)) };
  return { ok: true };
}

const reportSchema = z.object({
  jobId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).optional(),
  email: z.email().max(254).optional().or(z.literal("")),
});

export async function reportJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(String(formData.get("locale") ?? ""));
  const t = await getTranslations({ locale, namespace: "report" });
  const parsed = reportSchema.safeParse({
    jobId: formData.get("jobId"),
    reason: formData.get("reason"),
    details: formData.get("details") || undefined,
    email: formData.get("email") || undefined,
  });
  if (!parsed.success) return failure(t("invalid"));
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub ?? null;
  if (!userId) {
    if (!(await verifyTurnstile(formData.get("captchaToken") as string | null))) return failure(t("captcha"));
  }
  const key = userId ? `report:user:${userId}` : `report:ip:${await ipKey()}`;
  if (!(await rateLimit(key, 10, 3600))) return failure(t("rateLimited"));
  const admin = createAdminClient();
  const { data: job } = await admin.from("jobs").select("id, company_id").eq("id", parsed.data.jobId).maybeSingle();
  if (!job) return failure(t("invalid"));
  const { error } = await admin.from("reports").insert({
    job_id: job.id,
    company_id: job.company_id,
    reporter_id: userId,
    reporter_email: userId ? null : parsed.data.email || null,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });
  if (error) return failure(t("failed"));
  return success(t("thanks"));
}
