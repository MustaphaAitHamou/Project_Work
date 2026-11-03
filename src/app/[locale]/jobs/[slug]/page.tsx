import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, Building2, CalendarClock, Globe2, Languages, MapPin, ShieldCheck, Users, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPublicJob, getRegionNames, getSimilarJobs } from "@/lib/jobs/queries";
import { jobPath, parseJobSlug, formatDate } from "@/lib/format";
import { getLanguageNamer } from "@/lib/i18n/names-server";
import { siteUrl } from "@/lib/env";
import { companyLogoUrl } from "@/lib/storage";
import { buildJobPostingJsonLd, jsonLdScript } from "@/lib/seo/job-posting";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { JobBadges, LocationText, MetaLine, RemoteScopeText, SalaryText } from "@/components/jobs/job-meta";
import { RichText } from "@/components/jobs/rich-text";
import { ApplyButton, type ApplyState } from "@/components/jobs/apply-button";
import { SaveJobButton } from "@/components/jobs/save-job-button";
import { ReportDialog } from "@/components/jobs/report-dialog";
import { CompanyAvatar } from "@/components/companies/company-avatar";

type Props = { params: Promise<{ locale: string; slug: string }> };

const TRANSMITTED = ["identity", "contact", "location", "headline", "skills", "experience", "education", "languages", "preferences", "resume"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const publicId = parseJobSlug(slug);
  const job = publicId ? await getPublicJob(publicId) : null;
  if (!job) return {};
  const t = await getTranslations({ locale, namespace: "job" });
  const path = jobPath(job.slug!, job.public_id!);
  return {
    title: t("metaTitle", { title: job.title!, company: job.company_name!, city: job.city ?? "" }),
    description: (job.description ?? "").replace(/\s+/g, " ").slice(0, 160),
    alternates: { canonical: `/${locale}${path}`, languages: { fr: `/fr${path}`, en: `/en${path}`, es: `/es${path}`, ar: `/ar${path}` } },
    robots: job.is_open ? undefined : { index: false, follow: true },
    openGraph: { type: "article", title: `${job.title} · ${job.company_name}` },
  };
}

export default async function JobPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const publicId = parseJobSlug(slug);
  if (!publicId) notFound();
  const job = await getPublicJob(publicId);
  if (!job || !job.id) notFound();
  const canonical = `${job.slug}-${job.public_id}`;
  if (slug !== canonical) permanentRedirect(`/${locale}/jobs/${canonical}`);

  const [t, te, format, user, similar, regionNames] = await Promise.all([
    getTranslations("job"),
    getTranslations("enums"),
    getFormatter(),
    getSessionUser(),
    getSimilarJobs(job.id),
    getRegionNames(),
  ]);
  const languageName = await getLanguageNamer();
  const regionName = job.region_code ? regionNames.get(`${job.country_code}.${job.region_code}`) : null;
  const path = jobPath(job.slug!, job.public_id!);
  const loginHref = `/login?next=${encodeURIComponent(`/${locale}${path}`)}`;

  // Apply button state (server-side, from the database)
  let applyState: ApplyState;
  let saved = false;
  if (!job.is_open) applyState = { kind: "closed" };
  else if (!user) applyState = { kind: "anonymous", loginHref, signupHref: "/signup" };
  else if (user.accountType !== "candidate") applyState = { kind: "employer" };
  else {
    const supabase = await createClient();
    const [{ data: status }, { data: existing }, { data: savedRow }] = await Promise.all([
      supabase.rpc("get_my_candidate_status"),
      supabase.from("applications").select("id").eq("job_id", job.id).eq("candidate_id", user.id).maybeSingle(),
      supabase.from("saved_jobs").select("job_id").eq("job_id", job.id).eq("user_id", user.id).maybeSingle(),
    ]);
    saved = Boolean(savedRow);
    const s = (status ?? {}) as { complete?: boolean; missing?: string[]; consent_given?: boolean; consent_version?: string };
    if (existing) applyState = { kind: "applied", applicationId: existing.id };
    else if (!s.complete) applyState = { kind: "incomplete", missing: s.missing ?? [] };
    else if (!s.consent_given) applyState = { kind: "consent", consentVersion: s.consent_version ?? "", transmitted: TRANSMITTED };
    else applyState = { kind: "ready" };
  }

  const jsonLd = job.is_open
    ? buildJobPostingJsonLd(job as never, {
        url: siteUrl(`/${locale}${path}`),
        regionName,
        logoUrl: companyLogoUrl(job.company_logo_path),
        sectionTitles: { missions: t("missions"), profile: t("profile") },
      })
    : null;

  return (
    <div className="container-page py-8">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />}
      <nav aria-label={t("breadcrumb")} className="mb-4 text-sm text-muted-foreground">
        <Link href="/jobs" className="hover:underline">
          {t("allJobs")}
        </Link>{" "}
        / <span className="text-foreground">{job.title}</span>
      </nav>

      {!job.is_open && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle aria-hidden />
          <AlertTitle>{t("closedTitle")}</AlertTitle>
          <AlertDescription>{t("closedText")}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <article className="min-w-0 space-y-8">
          <header className="space-y-4">
            <div className="flex items-start gap-4">
              <CompanyAvatar name={job.company_name ?? ""} logoPath={job.company_logo_path} className="size-14" />
              <div className="min-w-0 space-y-1">
                <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{job.title}</h1>
                <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground">
                  <Link href={`/companies/${job.company_slug}`} className="font-medium text-foreground hover:underline">
                    {job.company_name}
                  </Link>
                  <Badge variant="success">
                    <ShieldCheck aria-hidden />
                    {t("verifiedCompany")}
                  </Badge>
                </p>
              </div>
            </div>
            <JobBadges contractType={job.contract_type!} workMode={job.work_mode!} workTime={job.work_time!} experienceLevel={job.experience_level!} />
            {job.published_at && (
              <p className="text-sm text-muted-foreground">
                {t("published", { when: format.relativeTime(new Date(job.published_at), new Date()) })}
                {job.application_deadline && <> · {t("deadline", { date: formatDate(job.application_deadline, locale) })}</>}
              </p>
            )}
          </header>

          <section aria-labelledby="desc" className="space-y-2">
            <h2 id="desc" className="text-lg font-semibold">
              {t("description")}
            </h2>
            <RichText text={job.description} />
          </section>
          {job.missions && (
            <section aria-labelledby="missions" className="space-y-2">
              <h2 id="missions" className="text-lg font-semibold">
                {t("missions")}
              </h2>
              <RichText text={job.missions} />
            </section>
          )}
          {job.profile_sought && (
            <section aria-labelledby="profile" className="space-y-2">
              <h2 id="profile" className="text-lg font-semibold">
                {t("profile")}
              </h2>
              <RichText text={job.profile_sought} />
            </section>
          )}
          {(job.required_skills?.length ?? 0) + (job.optional_skills?.length ?? 0) > 0 && (
            <section aria-labelledby="skills" className="space-y-3">
              <h2 id="skills" className="text-lg font-semibold">
                {t("skills")}
              </h2>
              {job.required_skills && job.required_skills.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t("requiredSkills")}</h3>
                  <ul className="flex flex-wrap gap-2">
                    {job.required_skills.map((s) => (
                      <li key={s}>
                        <Badge>{s}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {job.optional_skills && job.optional_skills.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t("optionalSkills")}</h3>
                  <ul className="flex flex-wrap gap-2">
                    {job.optional_skills.map((s) => (
                      <li key={s}>
                        <Badge variant="outline">{s}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
          {job.benefits && (
            <section aria-labelledby="benefits" className="space-y-2">
              <h2 id="benefits" className="text-lg font-semibold">
                {t("benefits")}
              </h2>
              <RichText text={job.benefits} />
            </section>
          )}
          <section aria-labelledby="conditions" className="space-y-3 rounded-xl border bg-muted/30 p-5">
            <h2 id="conditions" className="text-lg font-semibold">
              {t("conditions")}
            </h2>
            <MetaLine icon={ShieldCheck}>
              <strong>{t("workAuthorization")} :</strong> {te(`workAuthorization.${job.work_authorization!}`)}
            </MetaLine>
            {job.eligibility_notes && <MetaLine icon={AlertTriangle}>{job.eligibility_notes}</MetaLine>}
            {job.work_mode !== "onsite" && (
              <MetaLine icon={Globe2}>
                <RemoteScopeText mode={job.work_mode!} scope={job.remote_scope} countries={job.remote_countries} />
              </MetaLine>
            )}
            {job.working_languages && job.working_languages.length > 0 && (
              <MetaLine icon={Languages}>
                <strong>{t("workingLanguages")} :</strong> {job.working_languages.map((l) => languageName(l)).join(", ")}
              </MetaLine>
            )}
            {job.start_date && <MetaLine icon={CalendarClock}>{t("startDate", { date: formatDate(job.start_date, locale) })}</MetaLine>}
            {job.positions_count && job.positions_count > 1 && <MetaLine icon={Users}>{t("positions", { count: job.positions_count })}</MetaLine>}
            <p className="text-xs text-muted-foreground">{t("equalOpportunity")}</p>
          </section>
        </article>

        <aside className="space-y-4">
          <Card className="lg:sticky lg:top-20">
            <CardContent className="space-y-4 pt-5">
              <MetaLine icon={MapPin}>
                <LocationText city={job.city} country={job.country_code} regionName={regionName} />
                {job.address_line && <span className="block text-muted-foreground">{job.address_line}</span>}
              </MetaLine>
              <MetaLine icon={Wallet}>
                <SalaryText min={job.salary_min} max={job.salary_max} currency={job.salary_currency} period={job.salary_period} />
              </MetaLine>
              <MetaLine icon={Building2}>
                <Link href={`/companies/${job.company_slug}`} className="hover:underline">
                  {job.company_name}
                </Link>
              </MetaLine>
              <ApplyButton jobId={job.id} initial={applyState} jobTitle={job.title!} />
              {user?.accountType !== "employer" && job.is_open && (
                <SaveJobButton jobId={job.id} initialSaved={saved} loginHref={user ? undefined : loginHref} />
              )}
              <div className="flex justify-end">
                <ReportDialog jobId={job.id} anonymous={!user} />
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar" className="mt-12 space-y-4">
          <h2 id="similar" className="text-lg font-semibold">
            {t("similar")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {similar.map((s) => (
              <li key={s.id} className="rounded-xl border bg-card p-4">
                <Link href={jobPath(s.slug, s.public_id)} className="font-semibold hover:text-primary">
                  {s.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {s.company_name} · {s.city} · {te(`contractType.${s.contract_type}`)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
