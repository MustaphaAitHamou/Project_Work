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
import { getSessionUser, spacePath } from "@/lib/auth/session";
import { classifySignUpResult, signupFailureMessages, validateSignUp, type SignupFailureKind } from "@/lib/auth/signup-errors";

function localeFrom(formData: FormData): string {
  const l = String(formData.get("locale") ?? "");
  return (routing.locales as readonly string[]).includes(l) ? l : routing.defaultLocale;
}

export type SignupResultData = {
  /** "email_taken" makes the form offer the login and password-reset links. */
  reason?: SignupFailureKind;
  /** Supabase Auth error code, only outside production, to help diagnose a setup problem. */
  technical?: string;
};

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState<SignupResultData>> {
  const locale = localeFrom(formData);
  // Already signed in (e.g. the page was opened before logging in elsewhere): no second account.
  const current = await getSessionUser();
  if (current) redirect(spacePath(locale, current));
  const t = await getTranslations({ locale, namespace: "auth" });
  const checked = validateSignUp({
    accountType: formData.get("accountType"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    terms: formData.get("terms"),
  });
  if (!checked.ok) {
    const fieldErrors = Object.fromEntries(Object.entries(checked.fieldErrors).map(([f, key]) => [f, t(key as never)]));
    return failure(t(checked.message as never), fieldErrors);
  }
  const input = checked.data;
  const [ipOk, emailOk] = await Promise.all([
    rateLimit(`signup:${await ipKey()}`, 10, 3600),
    rateLimit(`signup:email:${input.email}`, 5, 3600),
  ]);
  if (!ipOk || !emailOk) return failure(t("errors.tooManyAttempts"));
  if ((await checkEmailDomain(input.email, { allowTestDomains: !isProductionDeployment() })) !== "ok") {
    return failure(t("validation.emailDomain"), { email: t("validation.emailDomain") });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: siteUrl("/auth/confirm"),
      captchaToken: (formData.get("captchaToken") as string) || undefined,
      data: {
        account_type: input.accountType,
        first_name: input.firstName,
        last_name: input.lastName,
        locale,
        terms_accepted: true,
        terms_version: TERMS_VERSION,
      },
    },
  });
  const outcome = classifySignUpResult(error, data?.user);
  if (outcome) {
    if (outcome.kind === "server") console.error("signUp failed", outcome.code, error?.status, error?.message);
    const { message, field } = signupFailureMessages(outcome.kind);
    // Product decision: the form says that an address may already have an account (the
    // Supabase Auth sign-up endpoint answers the same to anyone calling it directly);
    // enumeration is bounded by the per-IP and per-address limits above and the captcha.
    return {
      ...failure(t(message as never), field ? { [field.name]: t(field.message as never) } : undefined),
      data: { reason: outcome.kind, technical: isProductionDeployment() ? undefined : outcome.code },
    };
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
  // The anti-robot check happens before any account lookup: saying it failed reveals nothing,
  // and the visitor is not left waiting for an e-mail that was never sent.
  if (error?.code === "captcha_failed") return failure(t("captchaFailed"));
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
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: siteUrl("/auth/confirm"), captchaToken: (formData.get("captchaToken") as string) || undefined },
  });
  if (error?.code === "captcha_failed") return failure(t("captchaFailed"));
  if (error && error.status !== 429) console.error("resend confirmation", error.code);
  return success(t("confirmationResent"));
}
