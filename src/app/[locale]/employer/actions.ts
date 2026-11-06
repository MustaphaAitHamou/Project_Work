"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { errorKey } from "@/lib/errors";
import { failure, success, type ActionState } from "@/lib/action-state";
import { companyProfileSchema, companySchema, jobSchema } from "@/lib/validation/employer";
import { runCompanyVerification } from "@/lib/companies/verification/service";
import { flushOutboxQuietly } from "@/lib/email/outbox";
import { cancelSubscriptionsAtPeriodEnd, resumeRenewal } from "@/lib/billing/subscriptions";
import { rateLimit } from "@/lib/security/rate-limit";
import { routing } from "@/i18n/routing";

const L = (v: FormDataEntryValue | string | null) => {
  const l = String(v ?? "");
  return (routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale;
};
const jsonList = (v: FormDataEntryValue | null): string[] => {
  try {
    const parsed = JSON.parse(String(v ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

async function employerContext(locale: string) {
  const user = await getSessionUser();
  const te = await getTranslations({ locale, namespace: "errors" });
  if (!user || user.accountType !== "employer" || user.status !== "active") return { user: null as SessionUser | null, te };
  return { user, te };
}

function fieldErrorsFrom(issues: z.core.$ZodIssue[], t: (k: string) => string) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".");
    out[key] ??= t(`errors.${i.message && /^[a-z_]+$/.test(i.message) ? i.message : "invalid"}`);
  }
  return out;
}

// --- Company onboarding & profile ---------------------------------------------
function companyFromForm(formData: FormData) {
  const secondary: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("secondary.")) secondary[k.slice("secondary.".length)] = String(v);
  return companySchema.safeParse({
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName") ?? undefined,
    registrationCountry: formData.get("registrationCountry"),
    registrationIdType: formData.get("registrationIdType"),
    registrationNumber: formData.get("registrationNumber"),
    registrationRegion: formData.get("registrationRegion") ?? undefined,
    secondary,
    hqAddressLine1: formData.get("hqAddressLine1"),
    hqAddressLine2: formData.get("hqAddressLine2") ?? undefined,
    hqPostalCode: formData.get("hqPostalCode") ?? undefined,
    hqCity: formData.get("hqCity"),
    hqRegion: formData.get("hqRegion") ?? undefined,
    industry: formData.get("industry"),
    website: formData.get("website") ?? undefined,
    sizeRange: formData.get("sizeRange") || null,
    representativeTitle: formData.get("representativeTitle"),
    representativePhone: formData.get("representativePhone") ?? undefined,
    isLegalRepresentative: formData.get("isLegalRepresentative") === "on",
  });
}

export async function createCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = L(formData.get("locale"));
  const { user, te } = await employerContext(locale);
  const t = await getTranslations({ locale, namespace: "employer.company" });
  if (!user) return failure(te("forbidden"));
  const parsed = companyFromForm(formData);
  if (!parsed.success) return failure(t("errors.fix"), fieldErrorsFrom(parsed.error.issues, (k) => t(k as never)));
  const d = parsed.data;
  if (!(await rateLimit(`company:create:${user.id}`, 5, 3600))) return failure(te("rate_limited"));
  const { data: companyId, error } = await createAdminClient().rpc("create_company", {
    p_actor: user.id,
    p: {
      legal_name: d.legalName,
      display_name: d.displayName,
      registration_country: d.registrationCountry,
      registration_id_type: d.registrationIdType,
      registration_number: d.registrationNumber,
      registration_region: d.registrationRegion,
      secondary_identifiers: d.secondary,
      hq_address_line1: d.hqAddressLine1,
      hq_address_line2: d.hqAddressLine2,
      hq_postal_code: d.hqPostalCode,
      hq_city: d.hqCity,
      hq_region: d.hqRegion,
      hq_country: d.registrationCountry,
      industry: d.industry,
      website: d.website,
      size_range: d.sizeRange,
      representative_title: d.representativeTitle,
      representative_phone: d.representativePhone,
      is_legal_representative: d.isLegalRepresentative,
    },
  });
  if (error) return failure(te(errorKey(error)));
  // Automated registry checks run immediately; the outcome is shown on the verification page.
  await runCompanyVerification(user.id, companyId as string, locale);
  after(flushOutboxQuietly);
  redirect(`/${locale}/employer/verification`);
}

export async function updateRegistrationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = L(formData.get("locale"));
  const { user, te } = await employerContext(locale);
  const t = await getTranslations({ locale, namespace: "employer.company" });
  if (!user) return failure(te("forbidden"));
  const companyId = String(formData.get("companyId") ?? "");
  if (!z.uuid().safeParse(companyId).success) return failure(te("invalid_input"));
  const parsed = companyFromForm(formData);
  if (!parsed.success) return failure(t("errors.fix"), fieldErrorsFrom(parsed.error.issues, (k) => t(k as never)));
  const d = parsed.data;
  const { error } = await createAdminClient().rpc("update_company_registration", {
    p_actor: user.id,
    p_company_id: companyId,
    p: {
      legal_name: d.legalName,
      registration_region: d.registrationRegion,
      registration_id_type: d.registrationIdType,
      registration_number: d.registrationNumber,
      secondary_identifiers: d.secondary,
      hq_address_line1: d.hqAddressLine1,
      hq_address_line2: d.hqAddressLine2,
      hq_postal_code: d.hqPostalCode,
      hq_city: d.hqCity,
      hq_region: d.hqRegion,
      representative_title: d.representativeTitle,
      representative_phone: d.representativePhone,
      is_legal_representative: d.isLegalRepresentative,
    },
  });
  if (error) return failure(te(errorKey(error)));
  await runCompanyVerification(user.id, companyId, locale);
  after(flushOutboxQuietly);
  revalidatePath(`/${locale}/employer`, "layout");
  return success(t("updated"));
}

export async function updateCompanyProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = L(formData.get("locale"));
  const { user, te } = await employerContext(locale);
  const t = await getTranslations({ locale, namespace: "employer.company" });
  if (!user) return failure(te("forbidden"));
  const companyId = String(formData.get("companyId") ?? "");
  const parsed = companyProfileSchema.safeParse({
    displayName: formData.get("displayName") ?? undefined,
    description: formData.get("description") ?? undefined,
    website: formData.get("website") ?? undefined,
    industry: formData.get("industry"),
    sizeRange: formData.get("sizeRange") || null,
  });
  if (!parsed.success || !z.uuid().safeParse(companyId).success) return failure(t("errors.fix"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({
      display_name: parsed.data.displayName,
      description: parsed.data.description,
      website: parsed.data.website,
      industry: parsed.data.industry,
      size_range: parsed.data.sizeRange ?? null,
    })
    .eq("id", companyId);
  if (error) return failure(te(errorKey(error)));
  revalidatePath(`/${locale}/employer`, "layout");
  return success(t("profileSaved"));
}

export async function rerunVerificationAction(locale: string, companyId: string): Promise<ActionState> {
  const { user, te } = await employerContext(L(locale));
  if (!user || !z.uuid().safeParse(companyId).success) return failure(te("forbidden"));
  const result = await runCompanyVerification(user.id, companyId, L(locale));
  if (!result.ok) return failure(te(result.error));
  after(flushOutboxQuietly);
  revalidatePath(`/${L(locale)}/employer`, "layout");
  const t = await getTranslations({ locale: L(locale), namespace: "verification.messages" });
  return success(t(result.decision.messageKey));
}

// --- Jobs ----------------------------------------------------------------------
function jobFromForm(formData: FormData) {
  return jobSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    missions: formData.get("missions") ?? undefined,
    profileSought: formData.get("profileSought") ?? undefined,
    requiredSkills: jsonList(formData.get("requiredSkills")),
    optionalSkills: jsonList(formData.get("optionalSkills")),
    contractType: formData.get("contractType"),
    workTime: formData.get("workTime"),
    workMode: formData.get("workMode"),
    remoteScope: formData.get("remoteScope") || null,
    remoteCountries: formData.getAll("remoteCountries").map(String),
    salaryMin: (formData.get("salaryMin") as string) ?? undefined,
    salaryMax: (formData.get("salaryMax") as string) ?? undefined,
    salaryCurrency: formData.get("salaryCurrency") || null,
    salaryPeriod: formData.get("salaryPeriod") || null,
    benefits: formData.get("benefits") ?? undefined,
    experienceLevel: formData.get("experienceLevel"),
    industry: formData.get("industry") || null,
    workingLanguages: formData.getAll("workingLanguages").map(String),
    workAuthorization: formData.get("workAuthorization") ?? "not_specified",
    eligibilityNotes: formData.get("eligibilityNotes") ?? undefined,
    startDate: (formData.get("startDate") as string) ?? undefined,
    applicationDeadline: (formData.get("applicationDeadline") as string) ?? undefined,
    positionsCount: (formData.get("positionsCount") as string) ?? undefined,
    countryCode: formData.get("countryCode"),
    regionCode: formData.get("regionCode") ?? undefined,
    city: formData.get("city"),
    cityId: (formData.get("cityId") as string) ?? undefined,
    postalCode: formData.get("postalCode") ?? undefined,
    addressLine: formData.get("addressLine") ?? undefined,
  });
}

export async function saveJobAction(_prev: ActionState, formData: FormData): Promise<ActionState<{ jobId: string }>> {
  const locale = L(formData.get("locale"));
  const { user, te } = await employerContext(locale);
  const t = await getTranslations({ locale, namespace: "employer.jobForm" });
  if (!user) return failure(te("forbidden"));
  const intent = String(formData.get("intent") ?? "draft");
  const existingId = String(formData.get("jobId") ?? "");
  const parsed = jobFromForm(formData);
  if (!parsed.success) return failure(t("errors.fix"), fieldErrorsFrom(parsed.error.issues, (k) => t(k as never)));
  const d = parsed.data;
  const supabase = await createClient();
  const { data: membership } = await supabase.from("company_members").select("company_id").eq("user_id", user.id).maybeSingle();
  if (!membership) return failure(te("forbidden"));

  const row = {
    title: d.title,
    description: d.description,
    missions: d.missions,
    profile_sought: d.profileSought,
    required_skills: d.requiredSkills,
    optional_skills: d.optionalSkills,
    contract_type: d.contractType,
    work_time: d.workTime,
    work_mode: d.workMode,
    remote_scope: d.workMode === "onsite" ? null : (d.remoteScope ?? null),
    remote_countries: d.remoteScope === "listed_countries" ? d.remoteCountries : [],
    salary_min: d.salaryMin,
    salary_max: d.salaryMax,
    salary_currency: d.salaryMin !== null || d.salaryMax !== null ? (d.salaryCurrency ?? null) : null,
    salary_period: d.salaryMin !== null || d.salaryMax !== null ? (d.salaryPeriod ?? null) : null,
    benefits: d.benefits,
    experience_level: d.experienceLevel,
    industry: d.industry ?? null,
    working_languages: d.workingLanguages,
    work_authorization: d.workAuthorization,
    eligibility_notes: d.eligibilityNotes,
    start_date: d.startDate,
    application_deadline: d.applicationDeadline,
    positions_count: d.positionsCount,
  };
  let jobId = existingId;
  if (existingId) {
    if (!z.uuid().safeParse(existingId).success) return failure(te("invalid_input"));
    const { error } = await supabase.from("jobs").update(row).eq("id", existingId);
    if (error) return failure(te(errorKey(error)));
  } else {
    const { data, error } = await supabase
      .from("jobs")
      .insert({ ...row, company_id: membership.company_id, created_by: user.id })
      .select("id")
      .single();
    if (error) return failure(te(errorKey(error)));
    jobId = data.id;
  }
  const location = {
    job_id: jobId,
    company_id: membership.company_id,
    country_code: d.countryCode,
    region_code: d.regionCode,
    city: d.city,
    city_id: d.cityId,
    postal_code: d.postalCode,
    address_line: d.addressLine,
    is_primary: true,
  };
  const { data: existingLoc } = await supabase.from("job_locations").select("id").eq("job_id", jobId).eq("is_primary", true).maybeSingle();
  const locResult = existingLoc
    ? await supabase.from("job_locations").update(location).eq("id", existingLoc.id)
    : await supabase.from("job_locations").insert(location);
  if (locResult.error) return failure(te(errorKey(locResult.error)));

  revalidatePath(`/${locale}/employer/jobs`);
  if (intent === "submit") {
    const { data: submitted, error } = await supabase.rpc("submit_job", { p_job_id: jobId });
    if (error) {
      const key = errorKey(error);
      const details = key === "job_incomplete" && error.details ? ` (${error.details.split(",").map((x) => t(`incomplete.${x}` as never)).join(", ")})` : "";
      return { ok: false, message: `${te(key)}${details}`, data: { jobId }, at: Date.now() };
    }
    const status = (submitted as { status: string }).status;
    if (status === "pending_payment") redirect(`/${locale}/employer/checkout/${jobId}`);
    redirect(`/${locale}/employer/jobs/${jobId}?submitted=review`);
  }
  if (!existingId) redirect(`/${locale}/employer/jobs/${jobId}?saved=1`);
  return success(t("saved"), { jobId });
}

export async function closeJobAction(locale: string, jobId: string): Promise<ActionState> {
  const { user, te } = await employerContext(L(locale));
  const t = await getTranslations({ locale: L(locale), namespace: "employer.jobs" });
  if (!user || !z.uuid().safeParse(jobId).success) return failure(te("forbidden"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_job", { p_job_id: jobId });
  if (error) return failure(te(errorKey(error)));
  // Stop future renewals at Stripe (retried by the maintenance job on failure).
  await cancelSubscriptionsAtPeriodEnd((data as { cancel_subscription_ids: string[] }).cancel_subscription_ids);
  after(flushOutboxQuietly);
  revalidatePath(`/${L(locale)}/employer`, "layout");
  return success(t("closed"));
}

export async function reopenJobAction(locale: string, jobId: string): Promise<ActionState> {
  const { user, te } = await employerContext(L(locale));
  const t = await getTranslations({ locale: L(locale), namespace: "employer.jobs" });
  if (!user || !z.uuid().safeParse(jobId).success) return failure(te("forbidden"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reopen_job", { p_job_id: jobId });
  if (error) return failure(te(errorKey(error)));
  const subId = (data as { resume_subscription_id: string | null }).resume_subscription_id;
  if (subId) {
    try {
      await resumeRenewal(subId);
    } catch (e) {
      console.error("resume renewal failed", e);
    }
  }
  revalidatePath(`/${L(locale)}/employer`, "layout");
  return success(t("reopened"));
}

export async function deleteDraftAction(locale: string, jobId: string): Promise<ActionState> {
  const { user, te } = await employerContext(L(locale));
  const t = await getTranslations({ locale: L(locale), namespace: "employer.jobs" });
  if (!user || !z.uuid().safeParse(jobId).success) return failure(te("forbidden"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_draft_job", { p_job_id: jobId });
  if (error) return failure(te(errorKey(error)));
  revalidatePath(`/${L(locale)}/employer/jobs`);
  return success(t("deleted"));
}

// --- Applications --------------------------------------------------------------
const statusSchema = z.enum(["shortlisted", "rejected", "hired"]);

export async function setApplicationStatusAction(locale: string, applicationId: string, status: string): Promise<ActionState> {
  const { user, te } = await employerContext(L(locale));
  const t = await getTranslations({ locale: L(locale), namespace: "employer.applications" });
  const parsed = statusSchema.safeParse(status);
  if (!user || !parsed.success || !z.uuid().safeParse(applicationId).success) return failure(te("forbidden"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("recruiter_set_application_status", { p_application_id: applicationId, p_status: parsed.data });
  if (error) return failure(te(errorKey(error)));
  after(flushOutboxQuietly);
  revalidatePath(`/${L(locale)}/employer`, "layout");
  return success(t("statusUpdated"));
}

export async function updateApplicationMetaAction(
  locale: string,
  applicationId: string,
  meta: { rating?: number | null; archived?: boolean },
): Promise<ActionState> {
  const { user, te } = await employerContext(L(locale));
  const t = await getTranslations({ locale: L(locale), namespace: "employer.applications" });
  if (!user || !z.uuid().safeParse(applicationId).success) return failure(te("forbidden"));
  const rating = meta.rating === null || meta.rating === undefined ? null : z.number().int().min(1).max(5).safeParse(meta.rating).success ? meta.rating : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("recruiter_update_application", {
    p_application_id: applicationId,
    p_rating: rating as number,
    p_archived: meta.archived as boolean,
    p_clear_rating: meta.rating === null,
  });
  if (error) return failure(te(errorKey(error)));
  revalidatePath(`/${L(locale)}/employer`, "layout");
  return success(t("saved"));
}
