"use client";
import { useActionState } from "react";
import { Download, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { initialActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/forms/form-message";
import { deleteAccountAction, privacyRequestAction } from "@/app/[locale]/candidate/actions";

export interface PrivacyRequestItem {
  id: string;
  type: string;
  status: string;
  created_at: string;
  response: string | null;
}

export function PrivacyPanel({ requests, retentionMonths, accountType }: { requests: PrivacyRequestItem[]; retentionMonths: number; accountType: "candidate" | "employer" }) {
  const t = useTranslations("privacy");
  const te = useTranslations("enums");
  const locale = useLocale();
  const [reqState, reqAction] = useActionState(privacyRequestAction, initialActionState);
  const [delState, delAction] = useActionState(deleteAccountAction, initialActionState);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("exportTitle")}</CardTitle>
          <CardDescription>{t("exportText")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <a href="/api/me/export" download>
              <Download aria-hidden />
              {t("exportButton")}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("retentionTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{accountType === "candidate" ? t("retentionCandidate", { months: retentionMonths }) : t("retentionEmployer")}</p>
          <p>{t("retentionAccess")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("requestTitle")}</CardTitle>
          <CardDescription>{t("requestText")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={reqAction} className="space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <FormMessage state={reqState} />
            <FormField id="privacy-type" label={t("requestType")}>
              {(p) => (
                <NativeSelect {...p} name="type" defaultValue="rectification" className="sm:w-72">
                  {["rectification", "objection", "restriction", "other"].map((k) => (
                    <option key={k} value={k}>
                      {te(`privacyRequestType.${k}` as never)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="privacy-details" label={t("requestDetails")}>
              {(p) => <Textarea {...p} name="details" rows={4} maxLength={3000} required minLength={5} />}
            </FormField>
            <SubmitButton variant="outline">{t("requestSubmit")}</SubmitButton>
          </form>
          {requests.length > 0 && (
            <ul className="divide-y rounded-lg border text-sm">
              {requests.map((r) => (
                <li key={r.id} className="space-y-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{te(`privacyRequestType.${r.type}` as never)}</span>
                    <Badge variant={r.status === "completed" ? "success" : r.status === "rejected" ? "destructive" : "warning"}>
                      {te(`privacyRequestStatus.${r.status}` as never)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(r.created_at, locale)}</p>
                  {r.response && <p className="text-muted-foreground">{r.response}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">{t("deleteTitle")}</CardTitle>
          <CardDescription>{accountType === "candidate" ? t("deleteTextCandidate") : t("deleteTextEmployer")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={delAction} className="space-y-3">
            <input type="hidden" name="locale" value={locale} />
            <FormMessage state={delState} />
            <FormField id="confirmation" label={t("deleteConfirmLabel", { keyword: t("deleteKeyword") })}>
              {(p) => <Input {...p} name="confirmation" autoComplete="off" className="sm:w-72" />}
            </FormField>
            <SubmitButton variant="destructive">
              <Trash2 aria-hidden />
              {t("deleteButton")}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
