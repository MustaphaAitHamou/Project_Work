import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { AdminForm } from "@/components/admin/admin-form";
import { handleReportAction } from "../actions";

export default async function AdminReportsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ all?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, "reports.handle");
  const sp = await searchParams;
  const [t, te] = await Promise.all([getTranslations("admin.reports"), getTranslations("enums")]);
  const supabase = await createClient();
  let query = supabase.from("reports").select("*, jobs(id, title)").order("created_at", { ascending: true }).limit(200);
  if (!sp.all) query = query.in("status", ["open", "in_review"]);
  const { data } = await query;
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Link href={sp.all ? "/admin/reports" : "/admin/reports?all=1"} className="text-sm text-primary underline">
            {sp.all ? t("openOnly") : t("showAll")}
          </Link>
        }
      />
      {!data?.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{t("empty")}</p>}
      <ul className="space-y-3">
        {(data ?? []).map((r) => {
          const job = r.jobs as unknown as { id: string; title: string } | null;
          return (
            <li key={r.id}>
              <Card>
                <CardContent className="grid gap-4 pt-5 md:grid-cols-[1fr_320px]">
                  <div className="space-y-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <Badge variant="warning">{te(`reportReason.${r.reason}`)}</Badge>
                      <Badge variant="outline">{te(`reportStatus.${r.status}`)}</Badge>
                      <span className="text-muted-foreground">{formatDateTime(r.created_at, locale)}</span>
                    </p>
                    {job && (
                      <Link href={`/admin/jobs/${job.id}`} className="text-primary underline">
                        {job.title}
                      </Link>
                    )}
                    {r.details && <p className="whitespace-pre-line">{r.details}</p>}
                    <p className="text-xs text-muted-foreground">{r.reporter_id ? t("byUser") : r.reporter_email ? t("byEmail", { email: r.reporter_email }) : t("anonymous")}</p>
                    {r.resolution_note && <p className="text-xs text-muted-foreground">{t("resolution", { note: r.resolution_note })}</p>}
                  </div>
                  <AdminForm action={handleReportAction} hidden={{ reportId: r.id }} submitLabel={t("save")} size="sm">
                    <NativeSelect name="status" defaultValue={r.status === "open" ? "in_review" : r.status} aria-label={t("status")}>
                      {["open", "in_review", "resolved", "dismissed"].map((s) => (
                        <option key={s} value={s}>
                          {te(`reportStatus.${s}` as never)}
                        </option>
                      ))}
                    </NativeSelect>
                    <Input name="note" placeholder={t("notePlaceholder")} defaultValue={r.resolution_note ?? ""} aria-label={t("note")} />
                  </AdminForm>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
