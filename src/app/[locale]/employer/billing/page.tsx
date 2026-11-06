import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requireEmployer } from "@/lib/auth/session";
import { getMyCompany } from "@/lib/employer/queries";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import { formatDate, formatMoneyMinor } from "@/lib/format";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PortalButton } from "@/components/employer/portal-button";

const SUB_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  active: "success",
  trialing: "success",
  past_due: "warning",
  unpaid: "destructive",
  canceled: "muted",
  incomplete: "warning",
  checkout_pending: "muted",
  checkout_expired: "muted",
  incomplete_expired: "muted",
  paused: "warning",
};

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireEmployer(locale);
  const mine = await getMyCompany(user.id);
  if (!mine) redirect(`/${locale}/employer/onboarding`);
  const [t, te] = await Promise.all([getTranslations("billing"), getTranslations("enums")]);
  const supabase = await createClient();
  const [{ data: subs }, { data: invoices }, { data: failures }, { data: customer }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, status, unit_amount, currency, current_period_end, cancel_at_period_end, cancel_requested_at, job_id, jobs(title)")
      .eq("company_id", mine.company.id)
      .not("status", "in", "(checkout_pending,checkout_expired)")
      .order("created_at", { ascending: false }),
    supabase.from("invoices").select("*").eq("company_id", mine.company.id).order("stripe_created_at", { ascending: false }).limit(100),
    supabase.from("payments").select("id, amount, currency, created_at, failure_code").eq("company_id", mine.company.id).eq("status", "failed").order("created_at", { ascending: false }).limit(20),
    supabase.from("billing_customers").select("stripe_customer_id").eq("company_id", mine.company.id).maybeSingle(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} actions={<PortalButton disabled={!customer || !getStripe()} />} />
      <Card>
        <CardHeader>
          <CardTitle>{t("subscriptions")}</CardTitle>
          <CardDescription>{t("subscriptionsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!subs?.length ? (
            <p className="text-sm text-muted-foreground">{t("noSubscriptions")}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t("colJob")}</TH>
                  <TH>{t("colStatus")}</TH>
                  <TH>{t("colAmount")}</TH>
                  <TH>{t("colPeriodEnd")}</TH>
                </TR>
              </THead>
              <TBody>
                {subs.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <Link href={`/employer/jobs/${s.job_id}`} className="font-medium hover:text-primary">
                        {(s.jobs as unknown as { title: string } | null)?.title ?? "—"}
                      </Link>
                    </TD>
                    <TD>
                      <Badge variant={SUB_VARIANT[s.status] ?? "muted"}>{te(`subscriptionStatus.${s.status}` as never)}</Badge>
                      {(s.cancel_at_period_end || s.cancel_requested_at) && s.status === "active" && <p className="mt-1 text-xs text-muted-foreground">{t("notRenewed")}</p>}
                    </TD>
                    <TD>{s.unit_amount && s.currency ? `${formatMoneyMinor(s.unit_amount, s.currency, locale)} ${t("perMonth")}` : "—"}</TD>
                    <TD>{formatDate(s.current_period_end, locale)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {failures && failures.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle>{t("failedPayments")}</CardTitle>
            <CardDescription>{t("failedPaymentsHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {failures.map((f) => (
                <li key={f.id}>
                  {formatDate(f.created_at, locale)} · {formatMoneyMinor(f.amount, f.currency, locale)} · {f.failure_code ?? "—"}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("invoices")}</CardTitle>
        </CardHeader>
        <CardContent>
          {!invoices?.length ? (
            <p className="text-sm text-muted-foreground">{t("noInvoices")}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t("colNumber")}</TH>
                  <TH>{t("colDate")}</TH>
                  <TH>{t("colTotal")}</TH>
                  <TH>{t("colStatus")}</TH>
                  <TH>
                    <span className="sr-only">{t("colLinks")}</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {invoices.map((i) => (
                  <TR key={i.id}>
                    <TD>{i.number ?? "—"}</TD>
                    <TD>{formatDate(i.stripe_created_at, locale)}</TD>
                    <TD>
                      {i.total !== null && i.currency ? formatMoneyMinor(i.total, i.currency.toUpperCase(), locale) : "—"}
                      {i.tax ? <span className="block text-xs text-muted-foreground">{t("ofWhichTax", { tax: formatMoneyMinor(i.tax, (i.currency ?? "EUR").toUpperCase(), locale) })}</span> : null}
                    </TD>
                    <TD>{i.status ? t(`invoiceStatus.${i.status}` as never) : "—"}</TD>
                    <TD>
                      {(i.invoice_pdf || i.hosted_invoice_url) && (
                        <a href={i.invoice_pdf ?? i.hosted_invoice_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          {t("download")}
                          <ExternalLink className="size-3.5" aria-hidden />
                        </a>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{t("legalNotice")}</p>
    </div>
  );
}
