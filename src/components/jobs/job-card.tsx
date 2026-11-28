import { useFormatter, useTranslations } from "next-intl";
import { BadgeCheck, MapPin, Wallet } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { jobPath } from "@/lib/format";
import type { JobSearchRow } from "@/lib/jobs/queries";
import { CompanyAvatar } from "@/components/companies/company-avatar";
import { JobBadges, LocationText, SalaryText } from "./job-meta";

export function JobCard({ job, now, regionName }: { job: JobSearchRow; now: Date; regionName?: string | null }) {
  const format = useFormatter();
  const t = useTranslations("search");
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm transition duration-200 focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start gap-3.5">
        <CompanyAvatar name={job.company_name} logoPath={job.company_logo_path} className="size-11 rounded-xl text-[13px]" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] leading-snug font-bold">
            <Link href={jobPath(job.slug, job.public_id)} className="after:absolute after:inset-0 after:rounded-2xl group-hover:text-primary">
              {job.title}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="truncate">{job.company_name}</span>
            {/* Every company on Tamurt Jobs is verified before publishing. */}
            <BadgeCheck className="size-4 shrink-0 text-teal" aria-hidden />
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-1.5 text-sm">
        <p className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <LocationText city={job.city} country={job.country_code} regionName={regionName} />
          {job.distance_km !== null && job.distance_km !== undefined && (
            <span className="text-muted-foreground">· {t("distanceKm", { km: Math.round(job.distance_km) })}</span>
          )}
        </p>
        <p className="flex items-center gap-2">
          <Wallet className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <SalaryText min={job.salary_min} max={job.salary_max} currency={job.salary_currency} period={job.salary_period} />
        </p>
      </div>
      <div className="mt-4 border-t border-dashed pt-4">
        <JobBadges contractType={job.contract_type} workMode={job.work_mode} workTime={job.work_time} />
        {job.required_skills?.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label={t("skills")}>
            {job.required_skills.slice(0, 5).map((s) => (
              <li key={s} className="rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
      {job.published_at && (
        <time dateTime={job.published_at} className="mt-auto pt-3 text-end text-xs text-muted-foreground">
          {format.relativeTime(new Date(job.published_at), now)}
        </time>
      )}
    </article>
  );
}
