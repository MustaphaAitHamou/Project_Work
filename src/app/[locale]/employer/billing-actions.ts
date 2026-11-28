"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { getMyCompany } from "@/lib/employer/queries";
import { createJobCheckout, createPortalSession } from "@/lib/billing/checkout";
import { checkoutMode } from "@/lib/billing/checkout-mode";
import { createClient } from "@/lib/supabase/server";
import { failure, type ActionState } from "@/lib/action-state";
import { routing } from "@/i18n/routing";

const L = (v: FormDataEntryValue | string | null) => {
  const l = String(v ?? "");
  return (routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale;
};

export async function startCheckoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = L(formData.get("locale"));
  const te = await getTranslations({ locale, namespace: "errors" });
  const t = await getTranslations({ locale, namespace: "billing" });
  const user = await getSessionUser();
  if (!user || user.accountType !== "employer") return failure(te("forbidden"));
  const jobId = String(formData.get("jobId") ?? "");
  if (!z.uuid().safeParse(jobId).success) return failure(te("invalid_input"));
  if (formData.get("acceptTerms") !== "on") return failure(t("acceptTermsRequired"), { acceptTerms: t("acceptTermsRequired") });
  // Subscription taken while the advert is free (launch offer): the first charge, at the end
  // of the free period, needs its own explicit authorisation.
  const { data: job } = await (await createClient()).from("jobs").select("status, free_until, suspension_reason").eq("id", jobId).maybeSingle();
  const chargeConsented = formData.get("acceptCharge") === "on";
  if (job && checkoutMode(job, new Date()) === "convert" && !chargeConsented) {
    return failure(t("convertConsentRequired"), { acceptCharge: t("convertConsentRequired") });
  }
  const result = await createJobCheckout({ id: user.id, email: user.email, name: `${user.firstName} ${user.lastName}` }, jobId, locale, { chargeConsented });
  if (!result.ok) return failure(result.error === "consent_required" ? t("convertConsentRequired") : te(result.error));
  redirect(result.url);
}

export async function openPortalAction(locale: string): Promise<ActionState> {
  const l = L(locale);
  const te = await getTranslations({ locale: l, namespace: "errors" });
  const user = await getSessionUser();
  if (!user || user.accountType !== "employer") return failure(te("forbidden"));
  const mine = await getMyCompany(user.id);
  if (!mine) return failure(te("forbidden"));
  const result = await createPortalSession(mine.company.id, l);
  if (!result.ok) return failure(te(result.error));
  redirect(result.url);
}
