"use client";
import { useActionState, useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { REPORT_REASONS } from "@/lib/domain";
import { initialActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { Turnstile } from "@/components/forms/turnstile";
import { reportJobAction } from "@/app/[locale]/jobs/actions";

export function ReportDialog({ jobId, anonymous }: { jobId: string; anonymous: boolean }) {
  const t = useTranslations("report");
  const te = useTranslations("enums");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(reportJobAction, initialActionState);
  useEffect(() => {
    if (state.ok) {
      const id = setTimeout(() => setOpen(false), 1800);
      return () => clearTimeout(id);
    }
  }, [state]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag aria-hidden />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc("close")}>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="jobId" value={jobId} />
          <input type="hidden" name="locale" value={locale} />
          <FormMessage state={state} />
          <FormField id="report-reason" label={t("reason")} required>
            {(p) => (
              <NativeSelect {...p} name="reason" defaultValue="discrimination">
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {te(`reportReason.${r}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="report-details" label={t("details")}>
            {(p) => <Textarea {...p} name="details" maxLength={2000} rows={4} />}
          </FormField>
          {anonymous && (
            <FormField id="report-email" label={t("email")} hint={t("emailHint")}>
              {(p) => <Input {...p} name="email" type="email" autoComplete="email" />}
            </FormField>
          )}
          {anonymous && <Turnstile />}
          <SubmitButton className="w-full">{t("submit")}</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
