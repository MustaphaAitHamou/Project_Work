import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireEmployer } from "@/lib/auth/session";
import { getMyCompany } from "@/lib/employer/queries";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUS_VARIANT, type JobStatus } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { VerificationBanner } from "@/components/employer/verification-banner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EmployerHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireEmployer(locale);
  const mine = await getMyCompany(user.id);
  if (!mine) redirect(`/${locale}/employer/onboarding`);
  const [t, te] = await Promise.all([getTranslations("employer.home"), getTranslations("enums")]);
  const supabase = await createClient();
  const [{ data: jobs }, { count: newApps }, { count: totalApps }] = await Promise.all([
    supabase.from("jobs").select("id, title, status, published_at, updated_at").eq("company_id", mine.company.id).order("updated_at", { ascending: false }).limit(100),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("company_id", mine.company.id).eq("status", "submitted"),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("company_id", mine.company.id),
  ]);
  const byStatus = (s: JobStatus) => (jobs ?? []).filter((j) => j.status === s).length;
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title", { company: mine.company.display_name ?? mine.company.legal_name })}
        description={t("subtitle")}
        actions={
          <Button asChild>
            <Link href="/employer/jobs/new">
              <Plus aria-hidden />
              {t("newJob")}
            </Link>
          </Button>
        }
      />
      <VerificationBanner status={mine.company.verification_status} message={mine.company.verification_message} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t("activeJobs"), value: byStatus("active"), href: "/employer/jobs" },
          { label: t("pendingJobs"), value: byStatus("pending_payment") + byStatus("in_review") + byStatus("draft"), href: "/employer/jobs" },
          { label: t("newApplications"), value: newApps ?? 0, href: "/employer/jobs" },
          { label: t("totalApplications"), value: totalApps ?? 0, href: "/employer/jobs" },
        ].map((k) => (
          <Link key={k.label} href={k.href} className="rounded-xl border bg-card p-5 hover:shadow-sm">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-bold">{k.value}</p>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("recentJobs")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!jobs?.length ? (
            <p className="text-sm text-muted-foreground">{t("noJobs")}</p>
          ) : (
            <ul className="divide-y">
              {jobs.slice(0, 6).map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <Link href={`/employer/jobs/${j.id}`} className="font-medium hover:text-primary">
                    {j.title}
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-muted-foreground sm:inline">{formatDate(j.published_at ?? j.updated_at, locale)}</span>
                    <Badge variant={JOB_STATUS_VARIANT[j.status]}>{te(`jobStatus.${j.status}`)}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
