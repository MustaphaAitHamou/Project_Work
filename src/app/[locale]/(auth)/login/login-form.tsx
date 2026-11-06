"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { initialActionState } from "@/lib/action-state";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { Turnstile } from "@/components/forms/turnstile";
import { signInAction } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [state, action] = useActionState(signInAction, initialActionState);
  return (
    <ActionForm action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      <FormMessage state={state} />
      <FormField id="email" label={t("email")} required>
        {(p) => <Input {...p} name="email" type="email" autoComplete="email" inputMode="email" />}
      </FormField>
      <FormField id="password" label={t("password")} required>
        {(p) => <Input {...p} name="password" type="password" autoComplete="current-password" />}
      </FormField>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          {t("forgotPassword")}
        </Link>
      </div>
      <Turnstile />
      <SubmitButton className="w-full" pendingLabel={t("signingIn")}>
        {t("signIn")}
      </SubmitButton>
    </ActionForm>
  );
}
