"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { alertCriteria, parseSearchParams, toQueryString, type SearchParams } from "@/lib/search/params";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { errorKey } from "@/lib/errors";
import { failure, success, type ActionState } from "@/lib/action-state";
import { routing } from "@/i18n/routing";

const L = (l: string) => ((routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale);

function alertName(c: SearchParams, countryName: (code: string) => string, fallback: string) {
  const parts = [c.q, c.city, c.country ? countryName(c.country) : null].filter(Boolean);
  return (parts.join(" · ") || fallback).slice(0, 100);
}

export async function createAlertFromSearchAction(localeInput: string, criteriaInput: SearchParams): Promise<ActionState> {
  const locale = L(localeInput);
  const t = await getTranslations({ locale, namespace: "alerts" });
  const te = await getTranslations({ locale, namespace: "errors" });
  const user = await getSessionUser();
  if (!user || user.accountType !== "candidate") return failure(te("forbidden"));
  // Re-validate criteria server-side (never trust the client object).
  const criteria = alertCriteria(parseSearchParams(new URLSearchParams(toQueryString(criteriaInput))));
  const supabase = await createClient();
  const { error } = await supabase.from("job_alerts").insert({
    user_id: user.id,
    name: alertName(criteria, await getCountryNamer(locale), t("defaultName")),
    criteria: criteria as never,
    email_enabled: true,
    frequency: "daily",
    last_run_at: new Date().toISOString(),
  });
  if (error) return failure(te(errorKey(error)));
  revalidatePath(`/${locale}/candidate/alerts`);
  return success(t("created"));
}

const updateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  frequency: z.enum(["daily", "weekly"]),
  emailEnabled: z.boolean(),
});

export async function updateAlertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = L(String(formData.get("locale") ?? ""));
  const t = await getTranslations({ locale, namespace: "alerts" });
  const te = await getTranslations({ locale, namespace: "errors" });
  const user = await getSessionUser();
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    frequency: formData.get("frequency"),
    emailEnabled: formData.get("emailEnabled") === "on",
  });
  if (!user || !parsed.success) return failure(te("invalid_input"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("job_alerts")
    .update({ name: parsed.data.name, frequency: parsed.data.frequency, email_enabled: parsed.data.emailEnabled })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) return failure(te(errorKey(error)));
  revalidatePath(`/${locale}/candidate/alerts`);
  return success(t("updated"));
}

export async function deleteAlertAction(localeInput: string, id: string): Promise<ActionState> {
  const locale = L(localeInput);
  const t = await getTranslations({ locale, namespace: "alerts" });
  const te = await getTranslations({ locale, namespace: "errors" });
  const user = await getSessionUser();
  if (!user || !z.uuid().safeParse(id).success) return failure(te("forbidden"));
  const supabase = await createClient();
  const { error } = await supabase.from("job_alerts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return failure(te(errorKey(error)));
  revalidatePath(`/${locale}/candidate/alerts`);
  return success(t("deleted"));
}
