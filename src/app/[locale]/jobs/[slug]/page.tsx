import type { Metadata } from "next";
import { AdSlot } from "@/components/ads/ad-slot";
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

// What the recruiter sees, in two phases: anonymous profile first, identity only on acceptance.
const TRANSMITTED = {
  anonymous: ["headline", "skills", "experience", "education", "languages", "preferences", "location", "anonymizedCv"],
  onReveal: ["identity", "contact", "city", "resume"],
};

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
      <nav aria-label={t("breadcrumb")} className="mb-5 truncate text-sm text-muted-foreground">
        <Link href="/jobs" className="font-medium text-primary hover:underline">
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

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <article className="min-w-0 space-y-9">
          <header className="relative space-y-5 overflow-hidden rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,var(--secondary),transparent)]" />
            <div className="relative flex items-start gap-4">
              <CompanyAvatar name={job.company_name ?? ""} logoPath={job.company_logo_path} className="size-14 rounded-2xl bg-card text-base shadow-sm" />
              <div className="min-w-0 space-y-1.5">
                <h1 className="text-2xl leading-tight font-extrabold sm:text-[2rem]">{job.title}</h1>
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
            <div className="relative">
              <JobBadges contractType={job.contract_type!} workMode={job.work_mode!} workTime={job.work_time!} experienceLevel={job.experience_level!} />
            </div>
            {job.published_at && (
              <p className="relative text-sm text-muted-foreground">
                {t("published", { when: format.relativeTime(new Date(job.published_at), new Date()) })}
                {job.application_deadline && <> · {t("deadline", { date: formatDate(job.application_deadline, locale) })}</>}
              </p>
            )}
          </header>

          <section aria-labelledby="desc" className="space-y-2">
            <h2 id="desc" className="text-xl font-bold">
              {t("description")}
            </h2>
            <RichText text={job.description} />
          </section>
          {job.missions && (
            <section aria-labelledby="missions" className="space-y-2">
              <h2 id="missions" className="text-xl font-bold">
                {t("missions")}
              </h2>
              <RichText text={job.missions} />
            </section>
          )}
          {job.profile_sought && (
            <section aria-labelledby="profile" className="space-y-2">
              <h2 id="profile" className="text-xl font-bold">
                {t("profile")}
              </h2>
              <RichText text={job.profile_sought} />
            </section>
          )}
          {(job.required_skills?.length ?? 0) + (job.optional_skills?.length ?? 0) > 0 && (
            <section aria-labelledby="skills" className="space-y-3">
              <h2 id="skills" className="text-xl font-bold">
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
              <h2 id="benefits" className="text-xl font-bold">
                {t("benefits")}
              </h2>
              <RichText text={job.benefits} />
            </section>
          )}
          <section aria-labelledby="conditions" className="space-y-3 rounded-2xl border bg-card p-6 shadow-xs">
            <h2 id="conditions" className="text-xl font-bold">
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
          <Card className="overflow-hidden lg:sticky lg:top-24">
            <div aria-hidden className="h-1.5 bg-[image:var(--brand-gradient)]" />
            <CardContent className="space-y-4 pt-5 sm:pt-6">
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

      <AdSlot placement="job" />

      {similar.length > 0 && (
        <section aria-labelledby="similar" className="mt-12 space-y-4">
          <h2 id="similar" className="text-xl font-bold">
            {t("similar")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {similar.map((s) => (
              <li key={s.id} className="group relative rounded-2xl border bg-card p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <Link href={jobPath(s.slug, s.public_id)} className="font-display font-bold after:absolute after:inset-0 after:rounded-2xl group-hover:text-primary">
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
