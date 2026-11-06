import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUS_VARIANT } from "@/lib/domain";
import { formatDateTime, jobPath } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { RichText } from "@/components/jobs/rich-text";
import { JobBadges, LocationText, SalaryText } from "@/components/jobs/job-meta";
import { AdminForm } from "@/components/admin/admin-form";
import { moderateJobAction } from "../../actions";

export default async function AdminJobPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requirePermission(locale, "jobs.view");
  const canModerate = hasPermission(user.roles, "jobs.moderate");
  const supabase = await createClient();
  const [{ data: job }, { data: loc }, { data: reports }, { data: notes }, t, te, tf, tj] = await Promise.all([
    supabase.from("jobs").select("*, companies(id, legal_name, verification_status)").eq("id", id).maybeSingle(),
    supabase.from("job_locations").select("*").eq("job_id", id).eq("is_primary", true).maybeSingle(),
    supabase.from("reports").select("id, reason, details, status, created_at").eq("job_id", id).order("created_at", { ascending: false }),
    supabase.from("admin_internal_notes").select("note, created_at").eq("target_type", "job").eq("target_id", id).order("created_at", { ascending: false }),
    getTranslations("admin.jobs"),
    getTranslations("enums"),
    getTranslations("employer.jobForm.flags"),
    getTranslations("job"),
  ]);
  if (!job) notFound();
  const company = job.companies as unknown as { id: string; legal_name: string } | null;
  const decisions = job.status === "in_review" || job.status === "rejected" ? ["approve", "reject"] : job.status === "active" ? ["suspend", "reject"] : job.status === "suspended" ? ["reinstate", "reject"] : ["reject"];
  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title}
        description={company ? <Link href={`/admin/companies/${company.id}`} className="underline">{company.legal_name}</Link> : undefined}
        actions={<Badge variant={JOB_STATUS_VARIANT[job.status]}>{te(`jobStatus.${job.status}`)}</Badge>}
      />
      {job.moderation_flags.length > 0 && (
        <Alert variant="warning">
          <AlertTitle>{t("flagsTitle")}</AlertTitle>
          <AlertDescription>{job.moderation_flags.map((f) => tf(f as never)).join(" · ")}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <JobBadges contractType={job.contract_type} workMode={job.work_mode} workTime={job.work_time} experienceLevel={job.experience_level} />
            <p className="text-sm">
              <LocationText city={loc?.city ?? null} country={loc?.country_code ?? null} /> · <SalaryText min={job.salary_min} max={job.salary_max} currency={job.salary_currency} period={job.salary_period} />
            </p>
            <h2 className="font-semibold">{tj("description")}</h2>
            <RichText text={job.description} />
            {job.missions && (
              <>
                <h2 className="font-semibold">{tj("missions")}</h2>
                <RichText text={job.missions} />
              </>
            )}
            {job.profile_sought && (
              <>
                <h2 className="font-semibold">{tj("profile")}</h2>
                <RichText text={job.profile_sought} />
              </>
            )}
            {job.eligibility_notes && <p className="text-sm text-muted-foreground">{job.eligibility_notes}</p>}
            {job.published_at && ["active", "closed", "expired"].includes(job.status) && (
              <Link href={jobPath(job.slug, job.public_id)} className="text-sm text-primary underline">
                {t("publicPage")}
              </Link>
            )}
          </CardContent>
        </Card>
        <aside className="space-y-4">
          {canModerate && (
            <Card>
              <CardHeader>
                <CardTitle>{t("decisionTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <AdminForm action={moderateJobAction} hidden={{ jobId: job.id }} submitLabel={t("record")}>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t("decision")}</span>
                    <NativeSelect name="decision" defaultValue={decisions[0]}>
                      {decisions.map((d) => (
                        <option key={d} value={d}>
                          {t(`decisions.${d}` as never)}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t("reason")}</span>
                    <Textarea name="reason" rows={3} maxLength={1000} />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t("internalNote")}</span>
                    <Textarea name="internalNote" rows={2} maxLength={4000} />
                  </label>
                  <p className="text-xs text-muted-foreground">{t("rejectNotice")}</p>
                </AdminForm>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t("reports")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!reports?.length ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <p className="font-medium">
                        {te(`reportReason.${r.reason}`)} · {te(`reportStatus.${r.status}`)}
                      </p>
                      {r.details && <p className="text-muted-foreground">{r.details}</p>}
                      <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at, locale)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("internalNotes")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!notes?.length ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {notes.map((n, i) => (
                    <li key={i}>
                      <p className="whitespace-pre-line">{n.note}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(n.created_at, locale)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
