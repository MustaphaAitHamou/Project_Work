"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { failure, success, type ActionState } from "@/lib/action-state";
import { rateLimit } from "@/lib/security/rate-limit";
import { routing } from "@/i18n/routing";

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

function localeFrom(formData: FormData): string {
  const l = String(formData.get("locale") ?? "");
  return (routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale;
}

/** Starts the enrolment of an authenticator app (TOTP) for a back-office member. */
export async function startTotpEnrollmentAction(_prev: ActionState<TotpEnrollment>, formData: FormData): Promise<ActionState<TotpEnrollment>> {
  const locale = localeFrom(formData);
  const t = await getTranslations({ locale, namespace: "adminSecurity" });
  const user = await getSessionUser();
  if (!user || user.status !== "active" || user.roles.length === 0) return failure(t("notAllowed"));
  if (!(await rateLimit(`mfa-enroll:${user.id}`, 10, 3600))) return failure(t("rateLimited"));
  const supabase = await createClient();
  // Remove abandoned, never verified enrolments before starting a new one.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Tamurt Jobs",
    friendlyName: `Tamurt Jobs ${new Date().toISOString().slice(0, 16)}`,
  });
  if (error || !data) {
    console.error("mfa enroll failed", error?.code);
    return failure(t("error"));
  }
  return success(undefined, { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
}

/** Verifies a 6-digit code: the session becomes aal2 and the back-office opens. */
export async function verifyTotpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const t = await getTranslations({ locale, namespace: "adminSecurity" });
  const user = await getSessionUser();
  if (!user || user.status !== "active" || user.roles.length === 0) return failure(t("notAllowed"));
  const factorId = z.uuid().safeParse(formData.get("factorId"));
  const code = z
    .string()
    .regex(/^\d{6}$/)
    .safeParse(String(formData.get("code") ?? "").replace(/\s/g, ""));
  if (!factorId.success) return failure(t("error"));
  if (!code.success) return failure(t("invalidCode"), { code: t("invalidCode") });
  if (!(await rateLimit(`mfa-verify:${user.id}`, 10, 900))) return failure(t("rateLimited"));
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factorId.data, code: code.data });
  if (error) return failure(t("invalidCode"), { code: t("invalidCode") });
  redirect(`/${locale}/admin`);
}
