import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireEmployer } from "@/lib/auth/session";
import { getMyCompany } from "@/lib/employer/queries";
import { createClient } from "@/lib/supabase/server";
import { JOB_STATUS_VARIANT } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { offerLastDay } from "@/lib/billing/offer";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export default async function EmployerJobsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireEmployer(locale);
  const mine = await getMyCompany(user.id);
  if (!mine) redirect(`/${locale}/employer/onboarding`);
  const [t, te] = await Promise.all([getTranslations("employer.jobs"), getTranslations("enums")]);
  const supabase = await createClient();
  const [{ data: jobs }, { data: apps }] = await Promise.all([
    supabase.from("jobs").select("id, title, status, published_at, updated_at, free_until, suspension_reason, job_locations(city, country_code)").eq("company_id", mine.company.id).order("updated_at", { ascending: false }),
    // Recruiters do not read the applications table: counts come from a dedicated function.
    supabase.rpc("recruiter_application_counts"),
  ]);
  const counts = new Map<string, { total: number; fresh: number }>((apps ?? []).map((a) => [a.job_id, { total: a.total, fresh: a.fresh }]));
  const now = new Date();
  // Launch offer: when the free period of an advert ends, or that it is paused since then.
  const offerNote = (j: { status: string; free_until: string | null; suspension_reason: string | null }) =>
    j.status === "active" && j.free_until && new Date(j.free_until) > now
      ? t("freeBadge", { lastDay: offerLastDay(j.free_until, locale) })
      : (j.status === "suspended" && j.suspension_reason === "free_period_ended") || (j.status === "active" && j.free_until)
        ? t("pausedBadge")
        : null;
  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild>
            <Link href="/employer/jobs/new">
              <Plus aria-hidden />
              {t("new")}
            </Link>
          </Button>
        }
      />
      {!jobs?.length ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">{t("empty")}</p>
          <Button asChild className="mt-4">
            <Link href="/employer/jobs/new">{t("new")}</Link>
          </Button>
        </div>
      ) : (
        <Table>
          <caption className="sr-only">{t("title")}</caption>
          <THead>
            <TR>
              <TH>{t("colTitle")}</TH>
              <TH>{t("colStatus")}</TH>
              <TH>{t("colApplications")}</TH>
              <TH className="hidden md:table-cell">{t("colUpdated")}</TH>
            </TR>
          </THead>
          <TBody>
            {jobs.map((j) => {
              const c = counts.get(j.id);
              const loc = (j.job_locations as { city: string; country_code: string }[])?.[0];
              return (
                <TR key={j.id}>
                  <TD>
                    <Link href={`/employer/jobs/${j.id}`} className="font-medium hover:text-primary">
                      {j.title}
                    </Link>
                    {loc && <p className="text-xs text-muted-foreground">{loc.city}</p>}
                  </TD>
                  <TD>
                    <Badge variant={JOB_STATUS_VARIANT[j.status]}>{te(`jobStatus.${j.status}`)}</Badge>
                    {offerNote(j) && <p className="mt-1 text-xs text-muted-foreground">{offerNote(j)}</p>}
                  </TD>
                  <TD>
                    <Link href={`/employer/jobs/${j.id}/applications`} className="hover:underline">
                      {c?.total ?? 0}
                      {c?.fresh ? <span className="ms-1 text-xs font-semibold text-primary">({t("newCount", { count: c.fresh })})</span> : null}
                    </Link>
                  </TD>
                  <TD className="hidden text-muted-foreground md:table-cell">{formatDate(j.updated_at, locale)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}
