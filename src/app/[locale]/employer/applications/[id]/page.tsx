import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Download, Mail, MapPin, Phone } from "lucide-react";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { requireEmployer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUS_VARIANT, type ApplicationStatus } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/format";
import { getCountryNamer, getLanguageNamer } from "@/lib/i18n/names-server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationControls } from "@/components/employer/application-controls";

interface Snapshot {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  headline?: string | null;
  summary?: string | null;
  country_code?: string | null;
  city?: string | null;
  skills?: string[];
  languages?: { code: string; level: string }[];
  years_of_experience?: number | null;
  desired_contract_types?: string[];
  remote_preference?: string;
  willing_to_relocate?: boolean;
  mobility_countries?: string[];
  experiences?: { title: string; company_name: string | null; location: string | null; start_date: string; end_date: string | null; is_current: boolean; description: string | null }[];
  educations?: { degree: string; school: string | null; field_of_study: string | null; start_date: string | null; end_date: string | null }[];
}

export default async function ApplicationPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!z.uuid().safeParse(id).success) notFound();
  await requireEmployer(locale);
  const supabase = await createClient();
  // Opening the application is the real "viewed" event (status + access log), done in SQL.
  const mark = await supabase.rpc("recruiter_mark_viewed", { p_application_id: id });
  if (mark.error) notFound();
  const [{ data: app }, { data: history }, t, te, countryName, languageName] = await Promise.all([
    supabase.from("applications").select("*, jobs(id, title)").eq("id", id).maybeSingle(),
    supabase.from("application_status_history").select("to_status, actor, created_at").eq("application_id", id).order("created_at"),
    getTranslations("employer.applications"),
    getTranslations("enums"),
    getCountryNamer(),
    getLanguageNamer(),
  ]);
  if (!app) notFound();
  const s = app.candidate_snapshot as Snapshot;
  const job = app.jobs as unknown as { id: string; title: string } | null;
  const name = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
  return (
    <div className="space-y-6">
      <PageHeader
        title={name || "—"}
        description={
          <span>
            {t("appliedTo")}{" "}
            {job && (
              <Link href={`/employer/jobs/${job.id}/applications`} className="font-medium text-foreground underline">
                {job.title}
              </Link>
            )}{" "}
            · {formatDate(app.created_at, locale)}
          </span>
        }
        actions={<Badge variant={APPLICATION_STATUS_VARIANT[app.status as ApplicationStatus]}>{te(`applicationStatus.${app.status}`)}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{s.headline || t("profile")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {s.summary && <p className="whitespace-pre-line">{s.summary}</p>}
              {s.skills && s.skills.length > 0 && (
                <div>
                  <h3 className="mb-2 font-semibold">{t("skills")}</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {s.skills.map((k) => (
                      <li key={k}>
                        <Badge variant="secondary">{k}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {s.languages && s.languages.length > 0 && (
                <div>
                  <h3 className="mb-1 font-semibold">{t("languages")}</h3>
                  <p>{s.languages.map((l) => `${languageName(l.code)} (${te(`languageLevel.${l.level}` as never)})`).join(", ")}</p>
                </div>
              )}
              <dl className="grid gap-2 sm:grid-cols-2">
                {s.years_of_experience !== null && s.years_of_experience !== undefined && (
                  <div>
                    <dt className="text-muted-foreground">{t("experienceYears")}</dt>
                    <dd>{s.years_of_experience}</dd>
                  </div>
                )}
                {s.remote_preference && (
                  <div>
                    <dt className="text-muted-foreground">{t("remotePreference")}</dt>
                    <dd>{te(`remotePreference.${s.remote_preference}` as never)}</dd>
                  </div>
                )}
                {s.desired_contract_types && s.desired_contract_types.length > 0 && (
                  <div>
                    <dt className="text-muted-foreground">{t("contracts")}</dt>
                    <dd>{s.desired_contract_types.map((c) => te(`contractType.${c}` as never)).join(", ")}</dd>
                  </div>
                )}
                {s.mobility_countries && s.mobility_countries.length > 0 && (
                  <div>
                    <dt className="text-muted-foreground">{t("mobility")}</dt>
                    <dd>{s.mobility_countries.map((c) => countryName(c)).join(", ")}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
          {s.experiences && s.experiences.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("experiences")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4 text-sm">
                  {s.experiences.map((e, i) => (
                    <li key={i}>
                      <p className="font-medium">{e.title}</p>
                      <p className="text-muted-foreground">
                        {[e.company_name, e.location].filter(Boolean).join(" · ")} — {formatDate(e.start_date, locale, { month: "short", year: "numeric" })} –{" "}
                        {e.is_current ? t("present") : formatDate(e.end_date, locale, { month: "short", year: "numeric" })}
                      </p>
                      {e.description && <p className="mt-1 whitespace-pre-line">{e.description}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {s.educations && s.educations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("educations")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {s.educations.map((e, i) => (
                    <li key={i}>
                      <p className="font-medium">{e.degree}</p>
                      <p className="text-muted-foreground">{[e.school, e.field_of_study].filter(Boolean).join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("contact")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {s.email && (
                <a href={`mailto:${s.email}`} className="flex items-center gap-2 hover:underline">
                  <Mail className="size-4 text-muted-foreground" aria-hidden />
                  {s.email}
                </a>
              )}
              {s.phone && (
                <a href={`tel:${s.phone.replace(/[^+0-9]/g, "")}`} className="flex items-center gap-2 hover:underline">
                  <Phone className="size-4 text-muted-foreground" aria-hidden />
                  {s.phone}
                </a>
              )}
              {(s.city || s.country_code) && (
                <p className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" aria-hidden />
                  {[s.city, countryName(s.country_code)].filter(Boolean).join(", ")}
                </p>
              )}
              <p className="pt-2 text-xs text-muted-foreground">{t("contactNotice")}</p>
              {app.resume_version_id ? (
                <Button asChild className="mt-2 w-full">
                  <a href={`/api/resumes/versions/${app.resume_version_id}/download`}>
                    <Download aria-hidden />
                    {t("downloadCv")}
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">{t("cvUnavailable")}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("decision")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ApplicationControls applicationId={app.id} status={app.status} rating={app.recruiter_rating} archived={app.is_archived} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-1 border-s ps-4 text-sm">
                {(history ?? []).map((h, i) => (
                  <li key={i}>
                    {te(`applicationStatus.${h.to_status}`)} <span className="text-muted-foreground">· {formatDateTime(h.created_at, locale)}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
