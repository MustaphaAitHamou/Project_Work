import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { requireEmployer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { JobBadges, LocationText, SalaryText } from "@/components/jobs/job-meta";
import { RichText } from "@/components/jobs/rich-text";
import { Badge } from "@/components/ui/badge";

export default async function JobPreviewPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!z.uuid().safeParse(id).success) notFound();
  await requireEmployer(locale);
  const supabase = await createClient();
  const [{ data: job }, { data: loc }, t, tj] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).maybeSingle(),
    supabase.from("job_locations").select("*").eq("job_id", id).eq("is_primary", true).maybeSingle(),
    getTranslations("employer.jobs"),
    getTranslations("job"),
  ]);
  if (!job) notFound();
  return (
    <article className="space-y-6">
      <Alert variant="info">
        <AlertDescription>
          {t("previewNotice")}{" "}
          <Link href={`/employer/jobs/${id}`} className="underline">
            {t("backToEdit")}
          </Link>
        </AlertDescription>
      </Alert>
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">{job.title}</h1>
        <p className="text-muted-foreground">
          <LocationText city={loc?.city ?? null} country={loc?.country_code ?? null} />
        </p>
        <JobBadges contractType={job.contract_type} workMode={job.work_mode} workTime={job.work_time} experienceLevel={job.experience_level} />
        <p className="text-sm">
          <SalaryText min={job.salary_min} max={job.salary_max} currency={job.salary_currency} period={job.salary_period} />
        </p>
      </header>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">{tj("description")}</h2>
        <RichText text={job.description} />
      </section>
      {job.missions && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{tj("missions")}</h2>
          <RichText text={job.missions} />
        </section>
      )}
      {job.profile_sought && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{tj("profile")}</h2>
          <RichText text={job.profile_sought} />
        </section>
      )}
      {job.required_skills.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {job.required_skills.map((s) => (
            <li key={s}>
              <Badge>{s}</Badge>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
