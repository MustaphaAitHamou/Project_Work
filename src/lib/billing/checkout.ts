import "server-only";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, isProductionDeployment, siteUrl } from "@/lib/env";
import { errorKey, type ErrorKey } from "@/lib/errors";
import { getTranslations } from "next-intl/server";
import { formatMoneyMinor } from "@/lib/format";
import { getStripe, stripeMode } from "./stripe";
import { conversionTrialEnd, offerFirstPaidDay } from "./offer";

const STRIPE_LOCALES: Record<string, "fr" | "en" | "es" | "auto"> = { fr: "fr", en: "en", es: "es", ar: "auto" };

interface Prepared {
  job: { id: string; title: string; public_id: string; country_code: string };
  company: { id: string; name: string; registration_country: string };
  plan: { id: string; currency: string; unit_amount: number; tax_behavior: "exclusive" | "inclusive"; stripe_price_id: string | null };
  stripe_customer_id: string | null;
  sessions_to_expire: string[];
  /** Launch offer: the advert is online for free until then; the subscription starts with a trial ending then. */
  trial_until: string | null;
}

/**
 * Creates a Stripe Checkout Session (mode=subscription, one subscription per
 * advert). The advert is NOT activated here nor on the success URL: only the
 * signed webhook events do that.
 *
 * Launch offer: for an advert online for free, the subscription starts with a trial ending
 * at the end of its free period (nothing charged before), only with the explicit
 * authorisation of that first charge (`chargeConsented`).
 */
export async function createJobCheckout(
  actor: { id: string; email: string; name: string },
  jobId: string,
  locale: string,
  opts: { chargeConsented?: boolean; now?: Date } = {},
): Promise<{ ok: true; url: string } | { ok: false; error: ErrorKey }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "billing_unavailable" };
  // Never take real payments with test keys in production (and vice versa).
  if (isProductionDeployment() && stripeMode() !== "live") return { ok: false, error: "billing_unavailable" };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("billing_prepare_checkout", { p_actor: actor.id, p_job_id: jobId });
  if (error) return { ok: false, error: errorKey(error) };
  const prep = data as unknown as Prepared;
  const trialEnd = prep.trial_until ? conversionTrialEnd(prep.trial_until, opts.now ?? new Date()) : null;
  if (trialEnd && !opts.chargeConsented) return { ok: false, error: "consent_required" };

  for (const sessionId of prep.sessions_to_expire ?? []) {
    try {
      await stripe.checkout.sessions.expire(sessionId);
    } catch {
      /* already expired or completed: nothing to do */
    }
  }

  try {
    let customerId = prep.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { name: prep.company.name, email: actor.email, metadata: { company_id: prep.company.id, created_by: actor.id } },
        { idempotencyKey: `customer:${prep.company.id}` },
      );
      customerId = customer.id;
      await admin.rpc("billing_upsert_customer", { p_company_id: prep.company.id, p_customer_id: customerId });
    }

    const metadata = { job_id: prep.job.id, company_id: prep.company.id, plan_id: prep.plan.id };
    const lineItem = prep.plan.stripe_price_id
      ? { price: prep.plan.stripe_price_id, quantity: 1 }
      : {
          quantity: 1,
          price_data: {
            currency: prep.plan.currency.toLowerCase(),
            unit_amount: prep.plan.unit_amount,
            recurring: { interval: "month" as const },
            tax_behavior: prep.plan.tax_behavior,
            product_data: { name: env().STRIPE_PRODUCT_NAME, metadata: { plan_id: prep.plan.id } },
          },
        };
    const firstChargeNotice = trialEnd ? await firstChargeMessage(locale, trialEnd, prep.plan) : null;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: prep.job.id,
      line_items: [lineItem],
      metadata,
      subscription_data: {
        metadata,
        description: `${prep.job.title} (${prep.job.public_id})`,
        // Launch offer: free until the end of the free period, then the monthly price.
        ...(trialEnd ? { trial_end: Math.floor(trialEnd.getTime() / 1000), trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } } } : {}),
      },
      ...(trialEnd ? { payment_method_collection: "always" as const } : {}),
      ...(firstChargeNotice ? { custom_text: { submit: { message: firstChargeNotice } } } : {}),
      automatic_tax: { enabled: env().STRIPE_AUTOMATIC_TAX },
      // The price shown on Tamurt Jobs (and in the terms) is the price charged: no currency
      // conversion by Stripe (Adaptive Pricing would add conversion fees and another currency).
      adaptive_pricing: { enabled: false },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      locale: STRIPE_LOCALES[locale] ?? "auto",
      success_url: siteUrl(`/${locale}/employer/checkout/return?session_id={CHECKOUT_SESSION_ID}`),
      cancel_url: siteUrl(`/${locale}/employer/checkout/${prep.job.id}?canceled=1`),
    });
    const reg = await admin.rpc("billing_register_checkout", { p_job_id: prep.job.id, p_plan_id: prep.plan.id, p_session_id: session.id, p_customer_id: customerId });
    if (reg.error || !session.url) return { ok: false, error: "generic" };
    return { ok: true, url: session.url };
  } catch (e) {
    // Stripe unreachable or request refused: the recruiter gets a message instead of an error page.
    reportStripeError("checkout", e);
    return { ok: false, error: "generic" };
  }
}

/** Shown by Stripe above the subscribe button: when the first charge happens, and how much. */
async function firstChargeMessage(locale: string, trialEnd: Date, plan: Prepared["plan"]) {
  const t = await getTranslations({ locale, namespace: "billing" });
  const firstCharge = offerFirstPaidDay(trialEnd, locale);
  const price = t(plan.tax_behavior === "inclusive" ? "priceInclTax" : "priceExclTax", { price: formatMoneyMinor(plan.unit_amount, plan.currency, locale) });
  return `${t("convertFirstCharge", { firstCharge })} ${t("convertConsent", { price, firstCharge })}`.slice(0, 1200);
}

/** Stripe Customer Portal: update payment method, download invoices, cancel. */
export async function createPortalSession(companyId: string, locale: string): Promise<{ ok: true; url: string } | { ok: false; error: ErrorKey }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "billing_unavailable" };
  const { data } = await createAdminClient().from("billing_customers").select("stripe_customer_id").eq("company_id", companyId).maybeSingle();
  if (!data) return { ok: false, error: "not_found" };
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: siteUrl(`/${locale}/employer/billing`),
      locale: STRIPE_LOCALES[locale] ?? "auto",
    });
    return { ok: true, url: session.url };
  } catch (e) {
    // For example: no customer portal configuration saved in this Stripe mode (scripts/stripe-setup-portal.mjs).
    reportStripeError("portal", e);
    return { ok: false, error: "generic" };
  }
}

/**
 * Server log and Sentry (when configured). Only Stripe's error type, code, HTTP status and
 * request id are reported: an error message can quote a submitted value (name, e-mail).
 */
function reportStripeError(operation: string, e: unknown) {
  const err = (e ?? {}) as { type?: string; code?: string; requestId?: string; statusCode?: number };
  const details = { type: err.type ?? "unknown", code: err.code ?? "none", status: err.statusCode ?? 0, requestId: err.requestId ?? "none" };
  console.error(`stripe ${operation} failed`, details);
  Sentry.captureMessage(`Stripe ${operation} failed: ${details.type} / ${details.code}`, { level: "error", tags: { stripe_operation: operation }, extra: details });
}
