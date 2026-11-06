"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { Turnstile } from "@/components/forms/turnstile";
import { forgotPasswordAction } from "../actions";

export function ForgotForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(forgotPasswordAction, initialActionState);
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <FormField id="email" label={t("email")} required error={state.fieldErrors?.email}>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" />}
      </FormField>
      <Turnstile />
      <SubmitButton className="w-full">{t("sendResetLink")}</SubmitButton>
    </ActionForm>
  );
}
