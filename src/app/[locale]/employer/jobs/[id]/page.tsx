import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { requireEmployer } from "@/lib/auth/session";
import { getMyCompany } from "@/lib/employer/queries";
import { createClient } from "@/lib/supabase/server";
import { jobFormReference } from "@/lib/employer/job-form-data";
import { JOB_STATUS_VARIANT } from "@/lib/domain";
import { formatDate, jobPath } from "@/lib/format";
import { getLaunchOffer } from "@/lib/billing/launch-offer";
import { offerFirstPaidDay, offerLastDay } from "@/lib/billing/offer";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { JobForm } from "@/components/employer/job-form";
import { JobActions } from "@/components/employer/job-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function EmployerJobPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ submitted?: string; saved?: string; paid?: string; published?: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireEmployer(locale);
  const mine = await getMyCompany(user.id);
  if (!mine) redirect(`/${locale}/employer/onboarding`);
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: job }, { data: loc }, { data: subs }, { data: appCounts }, ref, t, te, offer] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", id).maybeSingle(),
    supabase.from("job_locations").select("*").eq("job_id", id).eq("is_primary", true).maybeSingle(),
    supabase.from("subscriptions").select("status, current_period_end, cancel_at_period_end, cancel_requested_at").eq("job_id", id).order("created_at", { ascending: false }).limit(1),
    supabase.rpc("recruiter_application_counts"),
    jobFormReference(),
    getTranslations("employer.jobs"),
    getTranslations("enums"),
    getLaunchOffer(),
  ]);
  if (!job) notFound();
  const count = (appCounts ?? []).find((c) => c.job_id === id)?.total ?? 0;
  const sub = subs?.[0];
  const now = new Date();
  const editable = ["draft", "pending_payment", "in_review", "rejected", "active"].includes(job.status);
  const liveSub = Boolean(sub && ["active", "trialing"].includes(sub.status) && sub.current_period_end && new Date(sub.current_period_end) > now);
  // Launch offer: online for free until free_until; at that instant it is paused (the
  // maintenance records it a little later, the advert is already hidden).
  const freeUntil = job.free_until ? new Date(job.free_until) : null;
  const isFree = job.status === "active" && freeUntil !== null && freeUntil > now;
  const freeEnded = (job.status === "suspended" && job.suspension_reason === "free_period_ended") || (job.status === "active" && freeUntil !== null && freeUntil <= now);
  const offerOpen = Boolean(offer?.open);
  // During the offer a closed advert reopens for free; afterwards it needs a running subscription.
  const canReopen = liveSub || offerOpen;
  const billingAction = job.status === "pending_payment" ? "pay" : isFree && !liveSub ? "convert" : freeEnded ? "reactivate" : null;
  const freeDays = freeUntil ? { lastDay: offerLastDay(freeUntil, locale), startDay: offerFirstPaidDay(freeUntil, locale) } : null;
  return (
    <div className="space-y-6">
      <PageHeader title={job.title} description={t("editDescription")} />
      {sp.submitted === "review" && (
        <Alert variant="warning">
          <AlertTitle>{t("inReviewTitle")}</AlertTitle>
          <AlertDescription>{offerOpen ? t("inReviewTextLaunch") : t("inReviewText")}</AlertDescription>
        </Alert>
      )}
      {isFree && freeDays && sp.published === "free" && (
        <Alert variant="success" data-testid="published-free">
          <AlertTitle>{t("publishedFreeTitle")}</AlertTitle>
          <AlertDescription>{t("publishedFreeText", { lastDay: freeDays.lastDay })}</AlertDescription>
        </Alert>
      )}
      {isFree && freeDays && sp.published !== "free" && !liveSub && (
        <Alert variant="info" data-testid="free-active">
          <AlertTitle>{t("freeActiveTitle", { lastDay: freeDays.lastDay })}</AlertTitle>
          <AlertDescription>{t("freeActiveText", { startDay: freeDays.startDay })}</AlertDescription>
        </Alert>
      )}
      {freeEnded && (
        <Alert variant="warning" data-testid="free-ended">
          <AlertTitle>{t("freeEndedTitle")}</AlertTitle>
          <AlertDescription>{t("freeEndedText")}</AlertDescription>
        </Alert>
      )}
      {sp.paid && job.status === "pending_payment" && (
        <Alert variant="info">
          <AlertTitle>{t("paymentProcessingTitle")}</AlertTitle>
          <AlertDescription>{t("paymentProcessingText")}</AlertDescription>
        </Alert>
      )}
      {job.status === "rejected" && job.rejection_reason && (
        <Alert variant="destructive">
          <AlertTitle>{t("rejectedTitle")}</AlertTitle>
          <AlertDescription>{job.rejection_reason}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2">
              {t("status")} <Badge variant={JOB_STATUS_VARIANT[job.status]}>{te(`jobStatus.${job.status}`)}</Badge>
              {job.suspension_reason && <span className="text-muted-foreground">({t(`suspension.${job.suspension_reason}` as never)})</span>}
            </p>
            {job.published_at && <p className="text-muted-foreground">{t("publishedOn", { date: formatDate(job.published_at, locale) })}</p>}
            {isFree && freeDays && !liveSub && <p className="text-muted-foreground">{t("freeBadge", { lastDay: freeDays.lastDay })}</p>}
            {sub?.current_period_end && (
              <p className="text-muted-foreground">
                {sub.cancel_at_period_end || sub.cancel_requested_at
                  ? t("endsOn", { date: formatDate(sub.current_period_end, locale) })
                  : sub.status === "trialing"
                    ? t("firstChargeOn", { date: offerFirstPaidDay(sub.current_period_end, locale) })
                    : t("renewsOn", { date: formatDate(sub.current_period_end, locale) })}
              </p>
            )}
          </div>
          <JobActions
            jobId={job.id}
            status={job.status}
            billingAction={billingAction}
            freeReopenUntil={offerOpen && offer ? offerLastDay(offer.freeUntil, locale) : null}
            canReopen={canReopen}
            paidThroughLabel={sub?.current_period_end && ["active", "trialing", "past_due"].includes(sub.status) ? formatDate(sub.current_period_end, locale) : null}
            publicHref={job.published_at && ["active", "closed", "expired"].includes(job.status) ? jobPath(job.slug, job.public_id) : null}
            applicationsCount={count ?? 0}
          />
        </CardContent>
      </Card>
      <JobForm
        editable={editable}
        live={["active", "pending_payment", "in_review"].includes(job.status)}
        flags={job.moderation_flags ?? []}
        regionsByCountry={ref.regionsByCountry}
        industries={ref.industries}
        publishableCountries={ref.publishableCountries}
        values={{
          jobId: job.id,
          title: job.title,
          description: job.description,
          missions: job.missions ?? "",
          profileSought: job.profile_sought ?? "",
          requiredSkills: job.required_skills ?? [],
          optionalSkills: job.optional_skills ?? [],
          contractType: job.contract_type,
          workTime: job.work_time,
          workMode: job.work_mode,
          remoteScope: job.remote_scope ?? "employer_country",
          remoteCountries: job.remote_countries ?? [],
          salaryMin: job.salary_min?.toString() ?? "",
          salaryMax: job.salary_max?.toString() ?? "",
          salaryCurrency: job.salary_currency ?? "EUR",
          salaryPeriod: job.salary_period ?? "year",
          benefits: job.benefits ?? "",
          experienceLevel: job.experience_level,
          industry: job.industry ?? "",
          workingLanguages: job.working_languages ?? [],
          workAuthorization: job.work_authorization,
          eligibilityNotes: job.eligibility_notes ?? "",
          startDate: job.start_date ?? "",
          applicationDeadline: job.application_deadline ?? "",
          positionsCount: job.positions_count?.toString() ?? "",
          countryCode: loc?.country_code ?? "FR",
          regionCode: loc?.region_code ?? "",
          city: loc?.city ?? "",
          cityId: loc?.city_id ?? null,
          postalCode: loc?.postal_code ?? "",
          addressLine: loc?.address_line ?? "",
        }}
      />
    </div>
  );
}
