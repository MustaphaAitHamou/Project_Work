"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { resetPasswordAction } from "../actions";

export function ResetForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(resetPasswordAction, initialActionState);
  if (state.ok) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Button asChild className="w-full">
          <Link href="/welcome">{t("continue")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <FormField id="password" label={t("newPassword")} hint={t("passwordHint")} required error={state.fieldErrors?.password}>
        {(p) => <Input {...p} name="password" type="password" autoComplete="new-password" />}
      </FormField>
      <FormField id="confirm" label={t("confirmPassword")} required error={state.fieldErrors?.confirm}>
        {(p) => <Input {...p} name="confirm" type="password" autoComplete="new-password" />}
      </FormField>
      <SubmitButton className="w-full">{t("updatePassword")}</SubmitButton>
    </ActionForm>
  );
}
