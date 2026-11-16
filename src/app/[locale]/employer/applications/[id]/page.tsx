import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Download, EyeOff, FileText, Lock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
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
import { IdentityRequestButton } from "@/components/employer/identity-request-button";
import { getRegionNames } from "@/lib/jobs/queries";

/** Professional profile transmitted with the application (no identity, see recruiter_get_application). */
interface Profile {
  headline?: string | null;
  summary?: string | null;
  country_code?: string | null;
  region_code?: string | null;
  skills?: string[];
  languages?: { code: string; level: string }[];
  years_of_experience?: number | null;
  desired_contract_types?: string[];
  remote_preference?: string;
  willing_to_relocate?: boolean;
  mobility_countries?: string[];
  experiences?: { title: string; company_name: string | null; location: string | null; start_date: string; end_date: string | null; is_current: boolean; description: string | null }[];
  educations?: { degree: string; school: string | null; field_of_study: string | null }[];
}

type RevealStatus = "none" | "pending" | "accepted" | "refused" | "revoked" | "expired";

interface RecruiterApplication {
  id: string;
  alias: string;
  status: ApplicationStatus;
  created_at: string;
  recruiter_rating: number | null;
  is_archived: boolean;
  job: { id: string; title: string };
  profile: Profile;
  history: { to_status: ApplicationStatus; actor: string; created_at: string }[];
  reveal: {
    status: RevealStatus;
    origin: "recruiter_request" | "legacy_consent" | null;
    requested_at: string | null;
    expires_at: string | null;
    responded_at: string | null;
    revoked_at: string | null;
    can_request: boolean;
    next_request_at: string | null;
  };
  identity: { first_name?: string; last_name?: string; email?: string; phone?: string; city?: string } | null;
  resume: { available: boolean; downloadable: boolean; anonymized_status: string | null; anonymized_text: string | null };
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
  // Everything the recruiter may see is decided in SQL (identity only after the candidate agreed).
  const [{ data, error }, t, ta, te, countryName, languageName, regionNames] = await Promise.all([
    supabase.rpc("recruiter_get_application", { p_application_id: id }),
    getTranslations("employer.applications"),
    getTranslations("anonymity"),
    getTranslations("enums"),
    getCountryNamer(),
    getLanguageNamer(),
    getRegionNames(),
  ]);
  if (error || !data) notFound();
  const app = data as unknown as RecruiterApplication;
  const s = app.profile;
  const job = app.job;
  const history = app.history;
  const identity = app.identity;
  const alias = ta("alias", { alias: app.alias });
  const name = identity ? `${identity.first_name ?? ""} ${identity.last_name ?? ""}`.trim() : "";
  const date = (v: string | null) => (v ? formatDate(v, locale) : "");
  const region = s.region_code ? regionNames.get(`${s.country_code}.${s.region_code}`) : null;
  return (
    <div className="space-y-6">
      <PageHeader
        title={name || alias}
        description={
          <span>
            {t("appliedTo")}{" "}
            {job && (
              <Link href={`/employer/jobs/${job.id}/applications`} className="font-medium text-foreground underline">
                {job.title}
              </Link>
            )}{" "}
            · {formatDate(app.created_at, locale)}
            {name && <span className="block text-xs">{alias}</span>}
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
                {(region || s.country_code) && (
                  <div>
                    <dt className="text-muted-foreground">{ta("recruiter.zone")}</dt>
                    <dd>{[region, countryName(s.country_code)].filter(Boolean).join(", ")}</dd>
                  </div>
                )}
                {s.willing_to_relocate && (
                  <div>
                    <dt className="text-muted-foreground">{ta("recruiter.relocate")}</dt>
                    <dd>✓</dd>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-primary" aria-hidden />
                {ta("recruiter.cvTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {app.resume.anonymized_text ? (
                <>
                  <p className="text-xs text-muted-foreground">{ta("recruiter.cvApproved")}</p>
                  {/* Long CVs scroll inside the card; focusable so that keyboard users can scroll it. */}
                  <div
                    tabIndex={0}
                    role="region"
                    aria-label={ta("recruiter.cvTitle")}
                    className="max-h-[32rem] overflow-y-auto rounded-md border bg-muted/30 p-4 leading-relaxed whitespace-pre-line focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {app.resume.anonymized_text}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">{ta("recruiter.cvNotApproved")}</p>
              )}
            </CardContent>
          </Card>
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {identity ? <ShieldCheck className="size-5 text-success" aria-hidden /> : <EyeOff className="size-5 text-primary" aria-hidden />}
                {ta("recruiter.identityTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {identity ? (
                <>
                  {name && <p className="font-semibold">{name}</p>}
                  {identity.email && (
                    <a href={`mailto:${identity.email}`} className="flex items-center gap-2 break-all hover:underline">
                      <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {identity.email}
                    </a>
                  )}
                  {identity.phone && (
                    <a href={`tel:${identity.phone.replace(/[^+0-9]/g, "")}`} className="flex items-center gap-2 hover:underline">
                      <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {identity.phone}
                    </a>
                  )}
                  {identity.city && (
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      {[identity.city, countryName(s.country_code)].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p className="pt-2 text-xs text-muted-foreground">
                    {app.reveal.origin === "legacy_consent" ? ta("recruiter.legacy") : ta("recruiter.accepted", { date: date(app.reveal.responded_at) })}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("contactNotice")}</p>
                  {app.resume.downloadable ? (
                    <Button asChild className="mt-2 w-full">
                      <a href={`/api/applications/${app.id}/resume`}>
                        <Download aria-hidden />
                        {ta("recruiter.downloadCv")}
                      </a>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("cvUnavailable")}</p>
                  )}
                </>
              ) : (
                <>
                  <p>{app.status === "rejected" ? ta("recruiter.rejectedNoAccess") : ta("recruiter.identityHidden")}</p>
                  {app.reveal.status === "pending" && (
                    <p className="rounded-md bg-warning/10 p-2">{ta("recruiter.pending", { date: date(app.reveal.requested_at), until: date(app.reveal.expires_at) })}</p>
                  )}
                  {app.reveal.status === "refused" && <p className="rounded-md bg-muted p-2">{ta("recruiter.refused", { date: date(app.reveal.responded_at) })}</p>}
                  {app.reveal.status === "revoked" && <p className="rounded-md bg-muted p-2">{ta("recruiter.revoked", { date: date(app.reveal.revoked_at) })}</p>}
                  {app.reveal.status === "expired" && <p className="rounded-md bg-muted p-2">{ta("recruiter.expired", { date: date(app.reveal.requested_at) })}</p>}
                  {app.reveal.next_request_at && <p className="text-xs text-muted-foreground">{ta("recruiter.nextRequest", { date: date(app.reveal.next_request_at) })}</p>}
                  {app.reveal.can_request && <IdentityRequestButton applicationId={app.id} />}
                  <p className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                    <Lock className="size-3.5 shrink-0" aria-hidden />
                    {ta("recruiter.cvLocked")}
                  </p>
                </>
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
                {history.map((h, i) => (
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
