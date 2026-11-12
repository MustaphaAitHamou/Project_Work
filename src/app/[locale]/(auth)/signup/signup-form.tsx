"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { Turnstile } from "@/components/forms/turnstile";
import { signUpAction } from "../actions";

export function SignupForm({ accountType }: { accountType: "candidate" | "employer" }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(signUpAction, initialActionState);
  const fe = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="accountType" value={accountType} />
      <FormMessage state={state} />
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
      <FormField id="passwordConfirm" label={t("confirmPassword")} required error={fe.confirm}>
        {(p) => <Input {...p} name="passwordConfirm" type="password" autoComplete="new-password" minLength={10} />}
      </FormField>
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox name="terms" className="mt-0.5" aria-invalid={fe.terms ? true : undefined} aria-describedby={fe.terms ? "terms-error" : undefined} />
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
      <p className="text-xs text-muted-foreground">{accountType === "employer" ? t("employerFree") : t("candidateFree")}</p>
    </ActionForm>
  );
}
