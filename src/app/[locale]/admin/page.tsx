import { getTranslations, setRequestLocale } from "next-intl/server";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { integrationStatus } from "@/lib/env";
import { formatDate, formatMoneyMinor, formatNumber } from "@/lib/format";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/admin/stat-card";
import { BarChart } from "@/components/admin/bar-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Stats {
  candidates: number;
  employers: number;
  companies_total: number;
  companies_verified: number;
  verifications_pending: number;
  jobs_active: number;
  jobs_in_review: number;
  jobs_expired: number;
  jobs_closed: number;
  applications_total: number;
  applications_30d: number;
  applications_by_country: { country_code: string; count: number }[];
  subscriptions_active: number;
  subscriptions_new_30d: number;
  cancellations_30d: number;
  mrr: { currency: string; amount: number }[];
  revenue_30d: { currency: string; amount: number }[];
  revenue_total: { currency: string; amount: number }[];
  payments_failed_30d: number;
  reports_open: number;
  privacy_requests_open: number;
  email_backlog: number;
  webhook_errors_7d: number;
}

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requirePermission(locale, "dashboard.view");
  // Revenue figures are restricted to finance roles (least privilege), even aggregated.
  const canSeeRevenue = hasPermission(me.roles, "payments.view");
  const supabase = await createClient();
  const [{ data: statsData }, { data: series }, t, countryName] =
    await Promise.all([
      supabase.rpc("admin_dashboard_stats"),
      supabase.rpc("admin_timeseries", { p_weeks: 12 }),
      getTranslations("admin.dashboard"),
      getCountryNamer(),
    ]);
  const s = statsData as unknown as Stats;
  const n = (v: number) => formatNumber(v, locale);
  const money = (rows: { currency: string; amount: number }[]) =>
    rows.length
      ? rows
          .map((r) => formatMoneyMinor(r.amount, r.currency, locale))
          .join(" · ")
      : formatMoneyMinor(0, "EUR", locale);
  const weeks = (series ?? []).map((w) => ({
    ...w,
    label: formatDate(w.week_start, locale, { day: "2-digit", month: "short" }),
  }));
  const integrations = integrationStatus();
  const tableLabels = {
    show: t("showData"),
    period: t("week"),
    value: t("value"),
  };
  const maxCountry = Math.max(
    1,
    ...s.applications_by_country.map((c) => c.count),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      {integrations.problems.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertTitle>{t("configProblems")}</AlertTitle>
          <AlertDescription>
            {integrations.problems
              .map((p) => t(`problems.${p}` as never))
              .join(" · ")}
          </AlertDescription>
        </Alert>
      )}
      <section aria-labelledby="kpi-people" className="space-y-3">
        <h2
          id="kpi-people"
          className="text-sm font-semibold text-muted-foreground"
        >
          {t("sectionActivity")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("candidates")}
            value={n(s.candidates)}
            href="/admin/users"
          />
          <StatCard
            label={t("companies")}
            value={n(s.companies_total)}
            hint={t("verifiedCount", { count: s.companies_verified })}
            href="/admin/companies"
          />
          <StatCard
            label={t("pendingVerifications")}
            value={n(s.verifications_pending)}
            href="/admin/companies?status=manual_review"
            tone={s.verifications_pending ? "warning" : "default"}
          />
          <StatCard
            label={t("activeJobs")}
            value={n(s.jobs_active)}
            hint={t("expiredClosed", {
              expired: s.jobs_expired,
              closed: s.jobs_closed,
            })}
            href="/admin/jobs"
          />
          <StatCard
            label={t("jobsInReview")}
            value={n(s.jobs_in_review)}
            href="/admin/jobs?status=in_review"
            tone={s.jobs_in_review ? "warning" : "default"}
          />
          <StatCard
            label={t("applications")}
            value={n(s.applications_total)}
            hint={t("last30", { count: s.applications_30d })}
          />
          <StatCard
            label={t("reports")}
            value={n(s.reports_open)}
            href="/admin/reports"
            tone={s.reports_open ? "warning" : "default"}
          />
          <StatCard
            label={t("privacyRequests")}
            value={n(s.privacy_requests_open)}
            href="/admin/privacy"
            tone={s.privacy_requests_open ? "warning" : "default"}
          />
        </div>
      </section>
      {canSeeRevenue && (
        <section aria-labelledby="kpi-money" className="space-y-3">
          <h2
            id="kpi-money"
            className="text-sm font-semibold text-muted-foreground"
          >
            {t("sectionRevenue")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("activeSubscriptions")}
              value={n(s.subscriptions_active)}
              hint={t("newLast30", { count: s.subscriptions_new_30d })}
              href="/admin/payments"
            />
            <StatCard
              label={t("mrr")}
              value={money(s.mrr)}
              hint={t("mrrHint")}
            />
            <StatCard
              label={t("revenue30")}
              value={money(s.revenue_30d)}
              hint={t("revenueTotal", { amount: money(s.revenue_total) })}
            />
            <StatCard
              label={t("failedPayments")}
              value={n(s.payments_failed_30d)}
              hint={t("cancellations", { count: s.cancellations_30d })}
              tone={s.payments_failed_30d ? "danger" : "default"}
              href="/admin/payments"
            />
          </div>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            ["candidates", t("chartCandidates")],
            ["applications", t("chartApplications")],
            ["jobs_published", t("chartJobs")],
            ["subscriptions", t("chartSubscriptions")],
          ] as const
        )
          .filter(([key]) => canSeeRevenue || key !== "subscriptions")
          .map(([key, title]) => (
            <Card key={key}>
              <CardContent className="pt-5">
                <BarChart
                  title={title}
                  data={weeks.map((w) => ({
                    label: w.label,
                    value: Number(w[key]),
                  }))}
                  tableLabels={tableLabels}
                />
              </CardContent>
            </Card>
          ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("byCountry")}</CardTitle>
            <CardDescription>{t("byCountryHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {s.applications_by_country.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noData")}</p>
            ) : (
              <ul className="space-y-2">
                {s.applications_by_country.map((c) => (
                  <li
                    key={c.country_code}
                    className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm"
                  >
                    <span className="truncate">
                      {countryName(c.country_code)}
                    </span>
                    <span
                      className="h-3 rounded-e bg-chart-1"
                      style={{
                        width: `${(c.count / maxCountry) * 100}%`,
                        minWidth: 2,
                      }}
                      aria-hidden
                    />
                    <span className="text-end tabular-nums">{n(c.count)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("operations")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              {
                ok: integrations.stripe.mode !== "missing",
                label: t("opStripe", { mode: integrations.stripe.mode }),
              },
              { ok: integrations.stripe.webhook, label: t("opWebhook") },
              {
                ok: integrations.email.provider !== "none",
                label: t("opEmail", { provider: integrations.email.provider }),
              },
              {
                ok: s.email_backlog === 0,
                label: t("opBacklog", { count: s.email_backlog }),
              },
              {
                ok: s.webhook_errors_7d === 0,
                label: t("opWebhookErrors", { count: s.webhook_errors_7d }),
              },
              { ok: integrations.captcha, label: t("opCaptcha") },
              ...Object.entries(integrations.registries).map(([k, v]) => ({
                ok: v,
                label: t("opRegistry", { name: t(`registries.${k}` as never) }),
              })),
            ].map((o, i) => (
              <p key={i} className="flex items-center gap-2">
                {o.ok ? (
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                ) : (
                  <AlertTriangle className="size-4 text-warning" aria-hidden />
                )}
                <span>{o.label}</span>
                <span className="sr-only">
                  {o.ok ? t("ok") : t("attention")}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
