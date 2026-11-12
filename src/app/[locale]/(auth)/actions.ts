"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { failure, success, type ActionState } from "@/lib/action-state";
import { ipKey, safeNextPath } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";
import { isProductionDeployment, siteUrl } from "@/lib/env";
import { checkEmailDomain } from "@/lib/security/email-domain";
import { routing } from "@/i18n/routing";
import { passwordSchema, TERMS_VERSION } from "@/lib/validation/auth";

function localeFrom(formData: FormData): string {
  const l = String(formData.get("locale") ?? "");
  return (routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale;
}

const signUpSchema = z.object({
  accountType: z.enum(["candidate", "employer"]),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  password: passwordSchema,
  passwordConfirm: z.string(),
  terms: z.literal("on"),
}).refine((v) => v.password === v.passwordConfirm, { path: ["confirm"] });

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const t = await getTranslations({ locale, namespace: "auth" });
  const parsed = signUpSchema.safeParse({
    accountType: formData.get("accountType"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm") ?? "",
    terms: formData.get("terms"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]);
      fieldErrors[field] ??= t(`validation.${field}` as never);
    }
    return failure(t("validation.fixErrors"), fieldErrors);
  }
  if (!(await rateLimit(`signup:${await ipKey()}`, 10, 3600))) {
    return failure(t("rateLimited"));
  }
  if ((await checkEmailDomain(parsed.data.email, { allowTestDomains: !isProductionDeployment() })) !== "ok") {
    return failure(t("validation.fixErrors"), { email: t("validation.emailDomain") });
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: siteUrl("/auth/confirm"),
      captchaToken: (formData.get("captchaToken") as string) || undefined,
      data: {
        account_type: parsed.data.accountType,
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        locale,
        terms_accepted: true,
        terms_version: TERMS_VERSION,
      },
    },
  });
  if (error) {
    if (error.code === "weak_password") return failure(t("validation.password"), { password: t("validation.password") });
    if (error.code === "over_email_send_rate_limit" || error.status === 429) return failure(t("rateLimited"));
    if (error.code === "captcha_failed") return failure(t("captchaFailed"));
    // Explicit on purpose (product decision): the sign-up form says when an address already
    // has an account. Enumeration is bounded by the per-IP rate limit and the captcha.
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return failure(t("emailAlreadyRegistered"), { email: t("emailAlreadyRegisteredShort") });
    }
    console.error("signUp failed", error.code, error.message);
    return failure(t("signupFailed"));
  }
  // An existing but unconfirmed address gets a new confirmation e-mail (Supabase resends it).
  redirect(`/${locale}/check-email?reason=signup`);
}

const signInSchema = z.object({ email: z.email(), password: z.string().min(1).max(200) });

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const t = await getTranslations({ locale, namespace: "auth" });
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: formData.get("password"),
  });
  if (!parsed.success) return failure(t("invalidCredentials"));

  const ip = await ipKey();
  const [ipOk, accountOk] = await Promise.all([
    rateLimit(`login:ip:${ip}`, 30, 900),
    rateLimit(`login:email:${parsed.data.email}`, 10, 900),
  ]);
  if (!ipOk || !accountOk) return failure(t("tooManyAttempts"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { captchaToken: (formData.get("captchaToken") as string) || undefined },
  });
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return failure(t("emailNotConfirmed"));
    if (error?.code === "captcha_failed") return failure(t("captchaFailed"));
    return failure(t("invalidCredentials"));
  }
  const next = safeNextPath(formData.get("next") as string | null, locale);
  if (next) redirect(next);
  const { data: profile } = await supabase.from("users").select("account_type").eq("id", data.user.id).single();
  redirect(`/${locale}/${profile?.account_type === "employer" ? "employer" : "candidate"}`);
}

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const t = await getTranslations({ locale, namespace: "auth" });
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return failure(t("validation.email"), { email: t("validation.email") });
  if (!(await rateLimit(`reset:${await ipKey()}`, 5, 3600))) return failure(t("rateLimited"));
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: siteUrl(`/auth/confirm`),
    captchaToken: (formData.get("captchaToken") as string) || undefined,
  });
  if (error && error.status !== 429) console.error("resetPasswordForEmail", error.code);
  // Generic answer: never reveal whether an account exists.
  return success(t("resetEmailSent"));
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const t = await getTranslations({ locale, namespace: "auth" });
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return failure(t("validation.password"), { password: t("validation.password") });
  if (formData.get("password") !== formData.get("confirm")) {
    return failure(t("validation.confirm"), { confirm: t("validation.confirm") });
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return failure(t("linkExpired"));
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) {
    if (error.code === "same_password") return failure(t("samePassword"));
    if (error.code === "weak_password") return failure(t("validation.password"));
    return failure(t("resetFailed"));
  }
  return success(t("passwordUpdated"));
}

export async function resendConfirmationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeFrom(formData);
  const t = await getTranslations({ locale, namespace: "auth" });
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return failure(t("validation.email"));
  if (!(await rateLimit(`resend:${await ipKey()}`, 5, 3600))) return failure(t("rateLimited"));
  const supabase = await createClient();
  await supabase.auth.resend({ type: "signup", email: email.data, options: { emailRedirectTo: siteUrl("/auth/confirm") } });
  return success(t("confirmationResent"));
}
