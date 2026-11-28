import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { z } from "zod";
import { requireEmployer } from "@/lib/auth/session";
import { getMyCompany } from "@/lib/employer/queries";
import { createClient } from "@/lib/supabase/server";
import { getJobPrice } from "@/lib/jobs/queries";
import { getStripe } from "@/lib/billing/stripe";
import { checkoutMode } from "@/lib/billing/checkout-mode";
import { conversionTrialEnd, offerFirstPaidDay, offerLastDay } from "@/lib/billing/offer";
import { formatMoneyMinor } from "@/lib/format";
import { env } from "@/lib/env";
import { getCountryNamer } from "@/lib/i18n/names-server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckoutForm } from "@/components/employer/checkout-form";

export default async function CheckoutPage({ params, searchParams }: { params: Promise<{ locale: string; jobId: string }>; searchParams: Promise<{ canceled?: string }> }) {
  const { locale, jobId } = await params;
  setRequestLocale(locale);
  if (!z.uuid().safeParse(jobId).success) notFound();
  const user = await requireEmployer(locale);
  const mine = await getMyCompany(user.id);
  if (!mine) redirect(`/${locale}/employer/onboarding`);
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: job }, { data: loc }, t, countryName] = await Promise.all([
    supabase.from("jobs").select("id, title, status, free_until, suspension_reason").eq("id", jobId).maybeSingle(),
    supabase.from("job_locations").select("country_code, city").eq("job_id", jobId).eq("is_primary", true).maybeSingle(),
    getTranslations("billing"),
    getCountryNamer(),
  ]);
  if (!job) notFound();
  // publish: awaiting payment; convert: online for free (launch offer), the subscription takes
  // over at the end of the free period; reactivate: paused at the end of the offer.
  const now = new Date();
  const mode = checkoutMode(job, now);
  if (!mode) redirect(`/${locale}/employer/jobs/${jobId}`);
  const price = await getJobPrice(loc?.country_code);
  const billingReady = Boolean(getStripe());
  const trialEnd = mode === "convert" && job.free_until ? conversionTrialEnd(job.free_until, now) : null;
  const firstCharge = trialEnd ? offerFirstPaidDay(trialEnd, locale) : null;
  const priceWithTax = price
    ? t(price.tax_behavior === "inclusive" ? "priceInclTax" : "priceExclTax", { price: formatMoneyMinor(price.unit_amount, price.currency, locale) })
    : null;
  const heading =
    mode === "convert"
      ? { title: t("convertTitle"), description: t("convertDescription", { lastDay: job.free_until ? offerLastDay(job.free_until, locale) : "" }) }
      : mode === "reactivate"
        ? { title: t("reactivateTitle"), description: t("reactivateDescription") }
        : { title: t("checkoutTitle"), description: t("checkoutDescription") };
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={heading.title} description={heading.description} />
      {sp.canceled && (
        <Alert variant="warning">
          <AlertDescription>{t("canceled")}</AlertDescription>
        </Alert>
      )}
      {!billingReady && (
        <Alert variant="destructive">
          <AlertTitle>{t("notConfiguredTitle")}</AlertTitle>
          <AlertDescription>{t("notConfiguredText")}</AlertDescription>
        </Alert>
      )}
      {firstCharge && (
        <Alert variant="info" data-testid="first-charge">
          <AlertTitle>{t("convertFirstCharge", { firstCharge })}</AlertTitle>
          <AlertDescription>{t("convertTrialNote")}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("summary")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("job")}</dt>
              <dd className="font-medium">{job.title}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("market")}</dt>
              <dd className="font-medium">{[loc?.city, countryName(loc?.country_code)].filter(Boolean).join(", ")}</dd>
            </div>
            {price && (
              <>
                <div>
                  <dt className="text-muted-foreground">{t("price")}</dt>
                  <dd className="text-lg font-bold text-primary">
                    {formatMoneyMinor(price.unit_amount, price.currency, locale)} <span className="text-sm font-normal text-muted-foreground">{t("perMonth")}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("billingCurrency")}</dt>
                  <dd className="font-medium">{price.currency}</dd>
                </div>
              </>
            )}
          </dl>
          <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
            <li>{price?.tax_behavior === "inclusive" ? t("taxInclusive") : env().STRIPE_AUTOMATIC_TAX ? t("taxExclusive") : t("taxExclusiveNoAutoTax")}</li>
            <li>{t("renewal")}</li>
            <li>{t("cancellation")}</li>
            <li>{mode === "convert" ? t("convertActivation") : t("activation")}</li>
          </ul>
          <CheckoutForm
            jobId={job.id}
            disabled={!billingReady || !price}
            chargeConsent={firstCharge && priceWithTax ? t("convertConsent", { price: priceWithTax, firstCharge }) : null}
            submitLabel={mode === "convert" ? t("convertButton") : mode === "reactivate" ? t("reactivateButton") : t("payButton")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
