#!/usr/bin/env node
// Creates or updates the Stripe Customer Portal configuration used by Tamurt Jobs
// (button « Gérer le paiement et les factures » of the recruiter area). Idempotent:
// the configuration is found again through its metadata (app=tamurt-jobs).
//
//   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup-portal.mjs --site-url https://jobs.example.com
//
// Live mode (sk_live_ / rk_live_) is refused unless --live is passed explicitly: the
// owner runs it at go-live, after approving real payments.
//
// What the recruiter can do in the portal:
//   - download invoices, update the payment method, the billing name, address and VAT number;
//   - cancel a subscription AT THE END OF THE PAID PERIOD only (the advert stays online
//     until then, as stated in the recruiter terms);
//   - no plan change (one subscription per advert, one price per country).
import Stripe from "stripe";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const key = process.env.STRIPE_SECRET_KEY ?? "";
const siteUrl = (flag("--site-url") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");

function stop(message) {
  console.error(`stripe-setup-portal: ${message}`);
  process.exit(1);
}

if (!key) stop("STRIPE_SECRET_KEY is required.");
if (live && !args.includes("--live")) stop("live key detected: pass --live to configure the live portal (go-live only).");
if (siteUrl && !/^https:\/\//.test(siteUrl)) stop("--site-url must be the public https:// address of the site.");

const stripe = new Stripe(key, {
  maxNetworkRetries: 2,
  ...(process.env.STRIPE_HTTP_CLIENT === "fetch" ? { httpClient: Stripe.createFetchHttpClient() } : {}),
});

const params = {
  business_profile: {
    headline: "Tamurt Jobs : paiement et factures de vos annonces",
    // Links shown in the portal; only set once the public domain exists.
    ...(siteUrl ? { privacy_policy_url: `${siteUrl}/fr/legal/privacy`, terms_of_service_url: `${siteUrl}/fr/legal/employer-terms` } : {}),
  },
  ...(siteUrl ? { default_return_url: `${siteUrl}/fr/employer/billing` } : {}),
  features: {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ["name", "address", "tax_id"] },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      proration_behavior: "none",
      cancellation_reason: { enabled: true, options: ["too_expensive", "unused", "switched_service", "other"] },
    },
    subscription_update: { enabled: false },
  },
  metadata: { app: "tamurt-jobs" },
};

const existing = [];
for await (const c of stripe.billingPortal.configurations.list({ limit: 100 })) existing.push(c);
const mine = existing.find((c) => c.metadata?.app === "tamurt-jobs");
const conf = mine ? await stripe.billingPortal.configurations.update(mine.id, { ...params, active: true }) : await stripe.billingPortal.configurations.create(params);

console.log(`stripe-setup-portal: ${mine ? "updated" : "created"} ${conf.id} (${live ? "live" : "test"} mode, default: ${conf.is_default})`);
console.log(`  cancellation: ${conf.features.subscription_cancel.mode}; plan change: ${conf.features.subscription_update.enabled ? "on" : "off"}; invoices: ${conf.features.invoice_history.enabled ? "on" : "off"}; payment method: ${conf.features.payment_method_update.enabled ? "on" : "off"}`);
if (!siteUrl) console.log("  no --site-url: terms and privacy links not set yet (run again once the domain exists).");
