import { useFormatter, useTranslations } from "next-intl";
import { Building2, MapPin, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { jobPath } from "@/lib/format";
import type { JobSearchRow } from "@/lib/jobs/queries";
import { JobBadges, LocationText, SalaryText } from "./job-meta";

export function JobCard({ job, now, regionName }: { job: JobSearchRow; now: Date; regionName?: string | null }) {
  const format = useFormatter();
  const t = useTranslations("search");
  return (
    <article className="group relative rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold leading-snug">
            <Link href={jobPath(job.slug, job.public_id)} className="after:absolute after:inset-0 group-hover:text-primary">
              {job.title}
            </Link>
          </h3>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Building2 className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{job.company_name}</span>
          </p>
        </div>
        {job.published_at && (
          <time dateTime={job.published_at} className="shrink-0 text-xs text-muted-foreground">
            {format.relativeTime(new Date(job.published_at), now)}
          </time>
        )}
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <p className="flex items-center gap-1.5">
          <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <LocationText city={job.city} country={job.country_code} regionName={regionName} />
          {job.distance_km !== null && job.distance_km !== undefined && (
            <span className="text-muted-foreground">· {t("distanceKm", { km: Math.round(job.distance_km) })}</span>
          )}
        </p>
        <p className="flex items-center gap-1.5">
          <Wallet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <SalaryText min={job.salary_min} max={job.salary_max} currency={job.salary_currency} period={job.salary_period} />
        </p>
      </div>
      <div className="mt-3">
        <JobBadges contractType={job.contract_type} workMode={job.work_mode} workTime={job.work_time} />
      </div>
      {job.required_skills?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("skills")}>
          {job.required_skills.slice(0, 5).map((s) => (
            <li key={s} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {s}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
