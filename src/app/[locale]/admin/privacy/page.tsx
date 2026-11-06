import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, isPast } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AdminForm } from "@/components/admin/admin-form";
import { eraseAccountAction, handlePrivacyAction } from "../actions";

export default async function AdminPrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, "privacy.handle");
  const [t, te] = await Promise.all([getTranslations("admin.privacy"), getTranslations("enums")]);
  const supabase = await createClient();
  const { data } = await supabase.from("privacy_requests").select("*").order("due_at", { ascending: true }).limit(200);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} />
      {!data?.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{t("empty")}</p>}
      <ul className="space-y-3">
        {(data ?? []).map((r) => {
          const late = isPast(r.due_at) && ["open", "in_progress"].includes(r.status);
          return (
            <li key={r.id}>
              <Card>
                <CardContent className="grid gap-4 pt-5 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {te(`privacyRequestType.${r.type}`)} <Badge variant={r.status === "completed" ? "success" : late ? "destructive" : "warning"}>{te(`privacyRequestStatus.${r.status}`)}</Badge>
                    </p>
                    <p className="text-muted-foreground">
                      {r.email} · {formatDateTime(r.created_at, locale)} · {t("due", { date: formatDate(r.due_at, locale) })}
                    </p>
                    {r.details && <p className="whitespace-pre-line">{r.details}</p>}
                    {r.response && <p className="text-muted-foreground">{t("response", { text: r.response })}</p>}
                  </div>
                  <div className="space-y-4">
                    <AdminForm action={handlePrivacyAction} hidden={{ requestId: r.id }} submitLabel={t("save")} size="sm">
                      <NativeSelect name="status" defaultValue={r.status} aria-label={t("status")}>
                        {["open", "in_progress", "completed", "rejected"].map((s) => (
                          <option key={s} value={s}>
                            {te(`privacyRequestStatus.${s}` as never)}
                          </option>
                        ))}
                      </NativeSelect>
                      <Textarea name="response" rows={2} defaultValue={r.response ?? ""} placeholder={t("responsePlaceholder")} aria-label={t("responsePlaceholder")} />
                    </AdminForm>
                    {r.type === "deletion" && r.user_id && r.status !== "completed" && (
                      <AdminForm action={eraseAccountAction} hidden={{ requestId: r.id, userId: r.user_id }} submitLabel={t("erase")} size="sm" variant="destructive">
                        <Input name="confirm" placeholder="ERASE" aria-label={t("eraseConfirm")} />
                        <p className="text-xs text-muted-foreground">{t("eraseHint")}</p>
                      </AdminForm>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
