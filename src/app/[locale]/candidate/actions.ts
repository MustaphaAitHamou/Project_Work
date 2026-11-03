"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { errorKey } from "@/lib/errors";
import { failure, success, type ActionState } from "@/lib/action-state";
import { educationSchema, experienceSchema, notificationSettingsSchema, profileSchema } from "@/lib/validation/candidate";
import { deleteAccount } from "@/lib/privacy/delete-account";
import { purgeResumeFiles } from "@/lib/files/resume-storage";
import { routing } from "@/i18n/routing";

const loc = (formData: FormData) => {
  const l = String(formData.get("locale") ?? "");
  return (routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale;
};
const json = <T,>(v: FormDataEntryValue | null, fallback: T): T => {
  try {
    return v ? (JSON.parse(String(v)) as T) : fallback;
  } catch {
    return fallback;
  }
};

async function candidateContext(locale: string) {
  const user = await getSessionUser();
  const t = await getTranslations({ locale, namespace: "candidate" });
  const te = await getTranslations({ locale, namespace: "errors" });
  if (!user || user.accountType !== "candidate" || user.status !== "active") return { user: null, t, te } as const;
  return { user, t, te, supabase: await createClient() } as const;
}

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData);
  const ctx = await candidateContext(locale);
  if (!ctx.user) return failure(ctx.te("forbidden"));
  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    headline: formData.get("headline"),
    summary: formData.get("summary") ?? undefined,
    countryCode: formData.get("countryCode"),
    regionCode: formData.get("regionCode") ?? undefined,
    city: formData.get("city"),
    phone: formData.get("phone") ?? undefined,
    skills: json(formData.get("skills"), []),
    languages: json(formData.get("languages"), []),
    desiredContractTypes: formData.getAll("desiredContractTypes"),
    desiredWorkTime: formData.getAll("desiredWorkTime"),
    remotePreference: formData.get("remotePreference") ?? "any",
    willingToRelocate: formData.get("willingToRelocate") === "on",
    mobilityCountries: formData.getAll("mobilityCountries"),
    yearsOfExperience: formData.get("yearsOfExperience") ? formData.get("yearsOfExperience") : null,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= ctx.t(`profile.errors.${String(issue.path[0])}` as never);
    return failure(ctx.t("profile.errors.fix"), fieldErrors);
  }
  const d = parsed.data;
  const [u, p] = await Promise.all([
    ctx.supabase.from("users").update({ first_name: d.firstName, last_name: d.lastName }).eq("id", ctx.user.id),
    ctx.supabase
      .from("candidate_profiles")
      .update({
        headline: d.headline,
        summary: d.summary,
        country_code: d.countryCode,
        region_code: d.regionCode,
        city: d.city,
        phone: d.phone,
        skills: d.skills,
        languages: d.languages,
        desired_contract_types: d.desiredContractTypes,
        desired_work_time: d.desiredWorkTime,
        remote_preference: d.remotePreference,
        willing_to_relocate: d.willingToRelocate,
        mobility_countries: d.mobilityCountries,
        years_of_experience: d.yearsOfExperience,
      })
      .eq("user_id", ctx.user.id),
  ]);
  const error = u.error ?? p.error;
  if (error) return failure(ctx.te(errorKey(error)));
  revalidatePath(`/${locale}/candidate`, "layout");
  return success(ctx.t("profile.saved"));
}

export async function saveExperienceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData);
  const ctx = await candidateContext(locale);
  if (!ctx.user) return failure(ctx.te("forbidden"));
  const parsed = experienceSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    companyName: formData.get("companyName") ?? undefined,
    location: formData.get("location") ?? undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") ?? undefined,
    isCurrent: formData.get("isCurrent") === "on",
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return failure(ctx.t("experience.invalid"));
  const d = parsed.data;
  const row = {
    user_id: ctx.user.id,
    title: d.title,
    company_name: d.companyName,
    location: d.location,
    start_date: d.startDate,
    end_date: d.isCurrent ? null : (d.endDate ?? null),
    is_current: d.isCurrent,
    description: d.description,
  };
  const { error } = d.id
    ? await ctx.supabase.from("candidate_experiences").update(row).eq("id", d.id).eq("user_id", ctx.user.id)
    : await ctx.supabase.from("candidate_experiences").insert(row);
  if (error) return failure(ctx.te(errorKey(error)));
  revalidatePath(`/${locale}/candidate/profile`);
  return success(ctx.t("experience.saved"));
}

export async function deleteExperienceAction(locale: string, id: string): Promise<ActionState> {
  const ctx = await candidateContext(locale);
  if (!ctx.user || !z.uuid().safeParse(id).success) return failure(ctx.te("forbidden"));
  const { error } = await ctx.supabase.from("candidate_experiences").delete().eq("id", id).eq("user_id", ctx.user.id);
  if (error) return failure(ctx.te(errorKey(error)));
  revalidatePath(`/${locale}/candidate/profile`);
  return success(ctx.t("experience.deleted"));
}

export async function saveEducationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData);
  const ctx = await candidateContext(locale);
  if (!ctx.user) return failure(ctx.te("forbidden"));
  const parsed = educationSchema.safeParse({
    id: formData.get("id") || undefined,
    degree: formData.get("degree"),
    school: formData.get("school") ?? undefined,
    fieldOfStudy: formData.get("fieldOfStudy") ?? undefined,
    startDate: formData.get("startDate") ?? undefined,
    endDate: formData.get("endDate") ?? undefined,
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return failure(ctx.t("education.invalid"));
  const d = parsed.data;
  const row = {
    user_id: ctx.user.id,
    degree: d.degree,
    school: d.school,
    field_of_study: d.fieldOfStudy,
    start_date: d.startDate ?? null,
    end_date: d.endDate ?? null,
    description: d.description,
  };
  const { error } = d.id
    ? await ctx.supabase.from("candidate_educations").update(row).eq("id", d.id).eq("user_id", ctx.user.id)
    : await ctx.supabase.from("candidate_educations").insert(row);
  if (error) return failure(ctx.te(errorKey(error)));
  revalidatePath(`/${locale}/candidate/profile`);
  return success(ctx.t("education.saved"));
}

export async function deleteEducationAction(locale: string, id: string): Promise<ActionState> {
  const ctx = await candidateContext(locale);
  if (!ctx.user || !z.uuid().safeParse(id).success) return failure(ctx.te("forbidden"));
  const { error } = await ctx.supabase.from("candidate_educations").delete().eq("id", id).eq("user_id", ctx.user.id);
  if (error) return failure(ctx.te(errorKey(error)));
  revalidatePath(`/${locale}/candidate/profile`);
  return success(ctx.t("education.deleted"));
}

// --- Resumes -----------------------------------------------------------------
export async function setPrimaryResumeAction(locale: string, resumeId: string): Promise<ActionState> {
  const ctx = await candidateContext(locale);
  if (!ctx.user || !z.uuid().safeParse(resumeId).success) return failure(ctx.te("forbidden"));
  const { error } = await ctx.supabase.rpc("set_primary_resume", { p_resume_id: resumeId });
  if (error) return failure(ctx.te(errorKey(error)));
  revalidatePath(`/${locale}/candidate`, "layout");
  return success(ctx.t("resumes.primarySet"));
}

export async function renameResumeAction(locale: string, resumeId: string, label: string): Promise<ActionState> {
  const ctx = await candidateContext(locale);
  const parsed = z.object({ id: z.uuid(), label: z.string().trim().min(1).max(100) }).safeParse({ id: resumeId, label });
  if (!ctx.user || !parsed.success) return failure(ctx.te("invalid_input"));
  const { error } = await ctx.supabase.from("candidate_resumes").update({ label: parsed.data.label }).eq("id", parsed.data.id).eq("user_id", ctx.user.id);
  if (error) return failure(ctx.te(errorKey(error)));
  revalidatePath(`/${locale}/candidate/resumes`);
  return success(ctx.t("resumes.renamed"));
}

export async function deleteResumeAction(locale: string, resumeId: string): Promise<ActionState> {
  const ctx = await candidateContext(locale);
  if (!ctx.user || !z.uuid().safeParse(resumeId).success) return failure(ctx.te("forbidden"));
  // Ownership is re-checked inside resume_delete (p_user_id must own the resume).
  const { data, error } = await createAdminClient().rpc("resume_delete", { p_user_id: ctx.user.id, p_resume_id: resumeId });
  if (error) return failure(ctx.te(errorKey(error)));
  await purgeResumeFiles((data as { purge: { version_id: string; storage_path: string }[] }).purge);
  revalidatePath(`/${locale}/candidate`, "layout");
  return success(ctx.t("resumes.deleted"));
}

// --- Applications --------------------------------------------------------------
export async function withdrawApplicationAction(locale: string, applicationId: string): Promise<ActionState> {
  const ctx = await candidateContext(locale);
  if (!ctx.user || !z.uuid().safeParse(applicationId).success) return failure(ctx.te("forbidden"));
  const { error } = await ctx.supabase.rpc("withdraw_application", { p_application_id: applicationId });
  if (error) return failure(ctx.te(errorKey(error)));
  revalidatePath(`/${locale}/candidate/applications`);
  return success(ctx.t("applications.withdrawn"));
}

// --- Settings ------------------------------------------------------------------
export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData);
  const user = await getSessionUser();
  const t = await getTranslations({ locale, namespace: "settings" });
  const te = await getTranslations({ locale, namespace: "errors" });
  if (!user) return failure(te("forbidden"));
  const parsed = notificationSettingsSchema.safeParse({
    locale: formData.get("preferredLocale"),
    notifyApplicationUpdates: formData.get("notifyApplicationUpdates") === "on",
    notifyJobAlerts: formData.get("notifyJobAlerts") === "on",
    notifyBilling: formData.get("notifyBilling") === "on",
  });
  if (!parsed.success) return failure(te("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({
      locale: parsed.data.locale,
      notify_application_updates: parsed.data.notifyApplicationUpdates,
      notify_job_alerts: parsed.data.notifyJobAlerts,
      notify_billing: parsed.data.notifyBilling,
    })
    .eq("id", user.id);
  if (error) return failure(te(errorKey(error)));
  // Keep Supabase Auth e-mails (password reset...) in the same language.
  await supabase.auth.updateUser({ data: { locale: parsed.data.locale } });
  return success(t("saved"));
}

export async function changeEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData);
  const t = await getTranslations({ locale, namespace: "settings" });
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return failure(t("invalidEmail"));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: email.data });
  if (error) return failure(t("emailChangeFailed"));
  return success(t("emailChangeSent"));
}

// --- Privacy -------------------------------------------------------------------
const privacySchema = z.object({
  type: z.enum(["rectification", "objection", "restriction", "other"]),
  details: z.string().trim().min(5).max(3000),
});

export async function privacyRequestAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData);
  const t = await getTranslations({ locale, namespace: "privacy" });
  const user = await getSessionUser();
  if (!user) return failure(t("error"));
  const parsed = privacySchema.safeParse({ type: formData.get("type"), details: formData.get("details") });
  if (!parsed.success) return failure(t("invalid"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("privacy_requests")
    .insert({ user_id: user.id, email: user.email, type: parsed.data.type, details: parsed.data.details });
  if (error) return failure(t("error"));
  revalidatePath(`/${locale}/candidate/privacy`);
  return success(t("requestSent"));
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = loc(formData);
  const t = await getTranslations({ locale, namespace: "privacy" });
  const user = await getSessionUser();
  if (!user) return failure(t("error"));
  if (String(formData.get("confirmation") ?? "").trim().toUpperCase() !== t("deleteKeyword").toUpperCase()) {
    return failure(t("deleteConfirmMismatch"));
  }
  const result = await deleteAccount(user.id);
  if (!result.ok) return failure(t("error"));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}?deleted=1`);
}
