"use client";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { initialActionState } from "@/lib/action-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { FormField } from "@/components/forms/form-field";
import { changeEmailAction, updateSettingsAction } from "@/app/[locale]/candidate/actions";

const LANGS: Record<string, string> = { fr: "Français", en: "English", es: "Español", ar: "العربية" };

export function SettingsForm({
  values,
  accountType,
}: {
  values: { locale: string; email: string; notifyApplicationUpdates: boolean; notifyJobAlerts: boolean; notifyBilling: boolean };
  accountType: "candidate" | "employer";
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const [state, action] = useActionState(updateSettingsAction, initialActionState);
  const [emailState, emailAction] = useActionState(changeEmailAction, initialActionState);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("preferencesTitle")}</CardTitle>
          <CardDescription>{t("preferencesHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <FormMessage state={state} toastOnSuccess />
            <FormField id="preferredLocale" label={t("language")}>
              {(p) => (
                <NativeSelect {...p} name="preferredLocale" defaultValue={values.locale} className="sm:w-60">
                  {Object.entries(LANGS).map(([k, v]) => (
                    <option key={k} value={k} lang={k}>
                      {v}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("notifications")}</legend>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="notifyApplicationUpdates" defaultChecked={values.notifyApplicationUpdates} />
                {accountType === "candidate" ? t("notifyApplicationUpdates") : t("notifyNewApplications")}
              </label>
              {accountType === "candidate" ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox name="notifyJobAlerts" defaultChecked={values.notifyJobAlerts} />
                  {t("notifyJobAlerts")}
                </label>
              ) : (
                <input type="hidden" name="notifyJobAlerts" value={values.notifyJobAlerts ? "on" : ""} />
              )}
              {accountType === "employer" ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox name="notifyBilling" defaultChecked={values.notifyBilling} />
                  {t("notifyBilling")}
                </label>
              ) : (
                <input type="hidden" name="notifyBilling" value={values.notifyBilling ? "on" : ""} />
              )}
              <p className="text-xs text-muted-foreground">{t("importantNotice")}</p>
            </fieldset>
            <SubmitButton>{t("save")}</SubmitButton>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("emailTitle")}</CardTitle>
          <CardDescription>{t("emailHint", { email: values.email })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={emailAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="locale" value={locale} />
            <div className="min-w-64 flex-1">
              <FormField id="newEmail" label={t("newEmail")}>
                {(p) => <Input {...p} name="email" type="email" autoComplete="email" required />}
              </FormField>
            </div>
            <SubmitButton variant="outline">{t("changeEmail")}</SubmitButton>
          </form>
          <div className="mt-3">
            <FormMessage state={emailState} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("passwordTitle")}</CardTitle>
          <CardDescription>{t("passwordHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/forgot-password">{t("changePassword")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
