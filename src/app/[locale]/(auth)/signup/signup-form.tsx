"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState, useEffect } from "react";
import { unstable_rethrow } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { failure, initialActionState, type ActionState } from "@/lib/action-state";
import { isNetworkFailure, SIGNUP_FIELDS } from "@/lib/auth/signup-errors";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { Turnstile } from "@/components/forms/turnstile";
import { signUpAction, type SignupResultData } from "../actions";

/** `freeNote`: pricing note computed by the page (launch offer), instead of the default one. */
export function SignupForm({ accountType, freeNote }: { accountType: "candidate" | "employer"; freeNote?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(
    async (prev: ActionState<SignupResultData>, formData: FormData): Promise<ActionState<SignupResultData>> => {
      // The Server Action is a network call: an offline browser or a dropped request must
      // not crash the page, and what was typed stays in the fields.
      if (typeof navigator !== "undefined" && navigator.onLine === false) return failure(t("errors.network"));
      try {
        return await signUpAction(prev, formData);
      } catch (error) {
        unstable_rethrow(error); // the redirect to "check your e-mail" travels as an error
        return failure(isNetworkFailure(error, navigator.onLine) ? t("errors.network") : t("errors.server"));
      }
    },
    initialActionState as ActionState<SignupResultData>,
  );
  const fe = state.fieldErrors ?? {};
  // Move the keyboard focus to the first field to fix after a refused submission.
  useEffect(() => {
    const first = SIGNUP_FIELDS.find((f) => state.fieldErrors?.[f]);
    if (first) document.getElementById(first)?.focus();
  }, [state]);
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="accountType" value={accountType} />
      <FormMessage state={state}>
        {state.data?.reason === "email_taken" && (
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-semibold">
            <Link href="/login" className="underline underline-offset-2">
              {t("signIn")}
            </Link>
            <Link href="/forgot-password" className="underline underline-offset-2">
              {t("resetMyPassword")}
            </Link>
          </p>
        )}
        {state.data?.technical && <p className="mt-2 text-xs opacity-80">{t("errors.technicalDetail", { code: state.data.technical })}</p>}
      </FormMessage>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="firstName" label={t("firstName")} required error={fe.firstName}>
          {(p) => <Input {...p} name="firstName" autoComplete="given-name" maxLength={100} />}
        </FormField>
        <FormField id="lastName" label={t("lastName")} required error={fe.lastName}>
          {(p) => <Input {...p} name="lastName" autoComplete="family-name" maxLength={100} />}
        </FormField>
      </div>
      <FormField
        id="email"
        label={accountType === "employer" ? t("professionalEmail") : t("email")}
        hint={accountType === "employer" ? t("professionalEmailHint") : undefined}
        required
        error={fe.email}
      >
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" />}
      </FormField>
      <FormField id="password" label={t("password")} hint={t("passwordHint")} required error={fe.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" minLength={10} />}
      </FormField>
      <FormField id="passwordConfirm" label={t("confirmPassword")} required error={fe.passwordConfirm}>
        {(p) => <Input {...p} name="passwordConfirm" type="password" autoComplete="new-password" minLength={10} />}
      </FormField>
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox id="terms" name="terms" className="mt-0.5" aria-invalid={fe.terms ? true : undefined} aria-describedby={fe.terms ? "terms-error" : undefined} />
          <span>
            {t.rich(accountType === "employer" ? "acceptEmployerTerms" : "acceptTerms", {
              terms: (chunks) => (
                <Link href="/legal/terms" className="text-primary underline" target="_blank">
                  {chunks}
                </Link>
              ),
              employerTerms: (chunks) => (
                <Link href="/legal/employer-terms" className="text-primary underline" target="_blank">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/legal/privacy" className="text-primary underline" target="_blank">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {fe.terms && (
          <p id="terms-error" className="text-xs font-medium text-destructive">
            {fe.terms}
          </p>
        )}
      </div>
      <Turnstile />
      <SubmitButton className="w-full" pendingLabel={t("creating")}>
        {t("createAccount")}
      </SubmitButton>
      <p className="text-xs text-muted-foreground">{accountType === "employer" ? (freeNote ?? t("employerFree")) : t("candidateFree")}</p>
    </ActionForm>
  );
}
