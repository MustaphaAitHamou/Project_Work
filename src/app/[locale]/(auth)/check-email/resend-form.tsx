"use client";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { resendConfirmationAction } from "../actions";

export function ResendForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(resendConfirmationAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <FormMessage state={state} />
      <label htmlFor="resend-email" className="text-sm font-medium">
        {t("resendLabel")}
      </label>
      <div className="flex gap-2">
        <Input id="resend-email" name="email" type="email" autoComplete="email" required />
        <SubmitButton variant="outline">{t("resend")}</SubmitButton>
      </div>
    </form>
  );
}
