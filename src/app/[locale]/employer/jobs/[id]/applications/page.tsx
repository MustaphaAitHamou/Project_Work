import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Star } from "lucide-react";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { requireEmployer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUS_VARIANT, type ApplicationStatus } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
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
  const [{ data: job }, t, te, countryName] = await Promise.all([
    supabase.from("jobs").select("id, title, required_skills").eq("id", id).maybeSingle(),
    getTranslations("employer.applications"),
    getTranslations("enums"),
    getCountryNamer(),
  ]);
  if (!job) notFound();
  let query = supabase
    .from("applications")
    .select("id, status, created_at, recruiter_rating, is_archived, first_viewed_at, candidate_snapshot")
    .eq("job_id", id)
    .eq("is_archived", archived)
    .limit(500);
  if (status) query = query.eq("status", status);
  const { data: apps } = await query.order("created_at", { ascending: sort === "oldest" });
  const required = new Set((job.required_skills ?? []).map((s) => s.toLocaleLowerCase()));
  const rows = (apps ?? []).map((a) => {
    const s = a.candidate_snapshot as { first_name?: string; last_name?: string; headline?: string; city?: string; country_code?: string; skills?: string[] };
    const matched = (s.skills ?? []).filter((x) => required.has(x.toLocaleLowerCase())).length;
    return { ...a, s, matched };
  });
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
                    {`${a.s.first_name ?? ""} ${a.s.last_name ?? ""}`.trim() || "—"}
                  </Link>
                  <p className="text-xs text-muted-foreground">{[a.s.headline, a.s.city, countryName(a.s.country_code)].filter(Boolean).join(" · ")}</p>
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
