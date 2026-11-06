"use client";
import { ActionForm } from "@/components/forms/action-form";
import { useActionState, useTransition } from "react";
import { Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { initialActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { deleteAlertAction, updateAlertAction } from "@/app/[locale]/candidate/alert-actions";

export interface AlertItem {
  id: string;
  name: string;
  frequency: "daily" | "weekly";
  email_enabled: boolean;
  last_sent_at: string | null;
  query: string;
  summary: string;
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const t = useTranslations("alerts");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action] = useActionState(updateAlertAction, initialActionState);
  const [pending, start] = useTransition();
  return (
    <li className="rounded-xl border bg-card p-4">
      <ActionForm action={action} className="space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={alert.id} />
        <FormMessage state={state} toastOnSuccess />
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("name")}</span>
            <Input name="name" defaultValue={alert.name} maxLength={100} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t("frequency")}</span>
            <NativeSelect name="frequency" defaultValue={alert.frequency}>
              <option value="daily">{t("daily")}</option>
              <option value="weekly">{t("weekly")}</option>
            </NativeSelect>
          </label>
        </div>
        <p className="text-sm text-muted-foreground">{alert.summary}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="emailEnabled" defaultChecked={alert.email_enabled} />
            {t("emailEnabled")}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href={`/jobs${alert.query ? `?${alert.query}` : ""}`}>
                <Search aria-hidden />
                {t("run")}
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await deleteAlertAction(locale, alert.id);
                  if (r.ok) toast.success(r.message);
                  else toast.error(r.message);
                })
              }
            >
              <Trash2 aria-hidden />
              {tc("delete")}
            </Button>
            <SubmitButton size="sm">{tc("save")}</SubmitButton>
          </div>
        </div>
        {alert.last_sent_at && <p className="text-xs text-muted-foreground">{t("lastSent", { date: formatDate(alert.last_sent_at, locale) })}</p>}
      </ActionForm>
    </li>
  );
}

export function AlertsList({ items }: { items: AlertItem[] }) {
  const t = useTranslations("alerts");
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">{t("empty")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
        <Button asChild className="mt-4">
          <Link href="/jobs">{t("goSearch")}</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <AlertRow key={a.id} alert={a} />
      ))}
    </ul>
  );
}
