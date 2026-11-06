import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUS_VARIANT, type JobStatus } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUSES: JobStatus[] = ["in_review", "pending_payment", "active", "suspended", "rejected", "closed", "expired", "draft"];

export default async function AdminJobsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission(locale, "jobs.view");
  const sp = await searchParams;
  const status = (STATUSES as string[]).includes(sp.status ?? "") ? (sp.status as JobStatus) : "in_review";
  const [t, te, tf] = await Promise.all([getTranslations("admin.jobs"), getTranslations("enums"), getTranslations("employer.jobForm.flags")]);
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("id, title, status, moderation_flags, updated_at, companies(legal_name)").eq("status", status).order("updated_at", { ascending: true }).limit(200);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} />
      <form method="get" className="flex items-end gap-2">
        <NativeSelect name="status" defaultValue={status} className="w-64" aria-label={t("status")}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {te(`jobStatus.${s}`)}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          {t("filter")}
        </Button>
      </form>
      {!data?.length ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("colJob")}</TH>
              <TH>{t("colCompany")}</TH>
              <TH>{t("colFlags")}</TH>
              <TH>{t("colStatus")}</TH>
              <TH>{t("colUpdated")}</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((j) => (
              <TR key={j.id}>
                <TD>
                  <Link href={`/admin/jobs/${j.id}`} className="font-medium hover:text-primary">
                    {j.title}
                  </Link>
                </TD>
                <TD>{(j.companies as unknown as { legal_name: string } | null)?.legal_name}</TD>
                <TD className="text-xs">{j.moderation_flags.map((f) => tf(f as never)).join(", ") || "—"}</TD>
                <TD>
                  <Badge variant={JOB_STATUS_VARIANT[j.status]}>{te(`jobStatus.${j.status}`)}</Badge>
                </TD>
                <TD className="text-muted-foreground">{formatDate(j.updated_at, locale)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
