import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EyeOff, Star } from "lucide-react";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { requireEmployer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUS_VARIANT, type ApplicationStatus } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { getRegionNames } from "@/lib/jobs/queries";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const STATUSES = ["submitted", "viewed", "shortlisted", "rejected", "hired", "job_closed"] as const;
const SORTS = ["recent", "oldest", "rating", "skills"] as const;

export default async function JobApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ status?: string; archived?: string; sort?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!z.uuid().safeParse(id).success) notFound();
  await requireEmployer(locale);
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as ApplicationStatus) : null;
  const sort = (SORTS as readonly string[]).includes(sp.sort ?? "") ? sp.sort! : "recent";
  const archived = sp.archived === "1";
  const supabase = await createClient();
  const [{ data: job }, t, ta, te, countryName, regionNames] = await Promise.all([
    supabase.from("jobs").select("id, title, required_skills").eq("id", id).maybeSingle(),
    getTranslations("employer.applications"),
    getTranslations("anonymity"),
    getTranslations("enums"),
    getCountryNamer(),
    getRegionNames(),
  ]);
  if (!job) notFound();
  // Anonymous list: alias and professional summary; the name only once the candidate agreed.
  const { data: apps } = await supabase.rpc("recruiter_list_applications", {
    p_job_id: id,
    p_status: status ?? undefined,
    p_archived: archived,
  });
  const required = new Set((job.required_skills ?? []).map((s) => s.toLocaleLowerCase()));
  const rows = (apps ?? []).map((a) => ({ ...a, matched: (a.skills ?? []).filter((x) => required.has(x.toLocaleLowerCase())).length }));
  if (sort === "oldest") rows.reverse();
  if (sort === "rating") rows.sort((a, b) => (b.recruiter_rating ?? 0) - (a.recruiter_rating ?? 0));
  if (sort === "skills") rows.sort((a, b) => b.matched - a.matched);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title", { job: job.title })} description={t("description")} />
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("filterStatus")}</span>
          <NativeSelect name="status" defaultValue={status ?? ""} className="w-48">
            <option value="">{t("allStatuses")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {te(`applicationStatus.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("sort")}</span>
          <NativeSelect name="sort" defaultValue={sort} className="w-56">
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sorts.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("view")}</span>
          <NativeSelect name="archived" defaultValue={archived ? "1" : "0"} className="w-44">
            <option value="0">{t("active")}</option>
            <option value="1">{t("archived")}</option>
          </NativeSelect>
        </label>
        <Button type="submit" variant="outline">
          {t("apply")}
        </Button>
      </form>
      <p className="flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-sm">
        <EyeOff className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {ta("recruiter.listNotice")}
      </p>
      <p className="text-xs text-muted-foreground">{t("skillsNotice")}</p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <Table>
          <caption className="sr-only">{t("title", { job: job.title })}</caption>
          <THead>
            <TR>
              <TH>{t("colCandidate")}</TH>
              <TH>{t("colStatus")}</TH>
              <TH className="hidden md:table-cell">{t("colSkills")}</TH>
              <TH className="hidden sm:table-cell">{t("colRating")}</TH>
              <TH>{t("colDate")}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((a) => (
              <TR key={a.id}>
                <TD>
                  <Link href={`/employer/applications/${a.id}`} className="font-medium hover:text-primary">
                    {a.identity_revealed && a.display_name ? a.display_name : ta("alias", { alias: a.alias })}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {[
                      a.identity_revealed && a.display_name ? ta("alias", { alias: a.alias }) : null,
                      a.headline,
                      a.region_code ? regionNames.get(`${a.country_code}.${a.region_code}`) : null,
                      countryName(a.country_code),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {a.reveal_status === "pending" && <Badge variant="warning" className="mt-1">{ta("pendingBadge")}</Badge>}
                  {a.identity_revealed && <Badge variant="success" className="mt-1">{ta("revealedBadge")}</Badge>}
                </TD>
                <TD>
                  <Badge variant={APPLICATION_STATUS_VARIANT[a.status]}>{te(`applicationStatus.${a.status}`)}</Badge>
                </TD>
                <TD className="hidden md:table-cell">{required.size ? t("skillsMatch", { matched: a.matched, total: required.size }) : "—"}</TD>
                <TD className="hidden sm:table-cell">
                  {a.recruiter_rating ? (
                    <span className="inline-flex items-center gap-1" aria-label={t("ratingLabel", { rating: a.recruiter_rating })}>
                      <Star className="size-4 fill-brand-warm text-brand-warm" aria-hidden /> {a.recruiter_rating}
                    </span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD className="text-muted-foreground">{formatDate(a.created_at, locale)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
