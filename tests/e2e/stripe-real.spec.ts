import { expect, test, type Browser, type Page } from "@playwright/test";
import Stripe from "stripe";
import { createCompany, createDraftJob, createTestUser, grantAdminRole, resetRateLimits, serviceClient, sql, type TestCompany } from "../helpers/supabase";

/**
 * Real Stripe test-mode journeys (no mock): prices, Checkout Sessions, customers,
 * cards, subscriptions, invoices, test clocks and refunds all live in the real
 * Stripe test environment. Webhooks reach the local app through
 * scripts/stripe-forward-events.mjs (see docs/STRIPE_TESTING.md).
 *
 * The card form of the hosted Checkout page is filled by hand on the
 * pre-production site (docs/RECETTE.md): this session's network proxy injects the
 * secret key into every request to api.stripe.com, which makes Stripe refuse the
 * card form submitted from a browser. Subscriptions are therefore created through
 * the API exactly as Checkout creates them (same customer, price and metadata).
 *
 * Skipped unless STRIPE_REAL=1. Never run with a live key.
 */
const REAL = process.env.STRIPE_REAL === "1";
const KEY = process.env.STRIPE_SECRET_KEY ?? "";
if (REAL && !KEY.startsWith("sk_test_") && !KEY.startsWith("rk_test_")) throw new Error("STRIPE_REAL requires a test-mode key");

test.skip(!REAL, "Real Stripe test-mode journeys: set STRIPE_REAL=1 (docs/STRIPE_TESTING.md).");
test.describe.configure({ mode: "serial" });
test.setTimeout(480_000);

const proxyServer = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const proxy = proxyServer ? { proxy: { server: proxyServer, bypass: "localhost,127.0.0.1" } } : {};
test.use({ locale: "fr-FR", ...proxy });

const stripe = REAL ? new Stripe(KEY, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 }) : (null as unknown as Stripe);
const CRON_SECRET = process.env.CRON_SECRET ?? "";

async function waitFor<T>(label: string, fn: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 120_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await fn();
    if (ok(last)) return last;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Timed out waiting for ${label}; last value: ${JSON.stringify(last)}`);
}

const jobRow = async (id: string) =>
  (await sql<{ status: string; suspension_reason: string | null; paid_through: string | null }>(`select status, suspension_reason, paid_through from public.jobs where id = $1`, [id]))[0];
const subRow = async (jobId: string) =>
  (
    await sql<{ stripe_subscription_id: string | null; stripe_checkout_session_id: string | null; status: string; cancel_at_period_end: boolean; grace_until: string | null }>(
      `select stripe_subscription_id, stripe_checkout_session_id, status, cancel_at_period_end, grace_until from public.subscriptions where job_id = $1 order by created_at desc limit 1`,
      [jobId],
    )
  )[0];
const payments = async (subscriptionId: string) =>
  sql<{ id: string; status: string; amount: number; amount_refunded: number; failure_code: string | null }>(
    `select p.id, p.status, p.amount, p.amount_refunded, p.failure_code from public.payments p join public.subscriptions s on s.id = p.subscription_id where s.stripe_subscription_id = $1 order by p.created_at`,
    [subscriptionId],
  );
const defaultPlan = async () =>
  (await sql<{ id: string; stripe_price_id: string | null }>(`select id, stripe_price_id from public.pricing_plans where code = 'job_monthly' and country_code is null and currency = 'EUR' and is_active order by created_at desc limit 1`))[0];

async function login(page: Page, email: string, password: string) {
  await page.goto("/fr/login");
  await page.getByRole("textbox", { name: "Adresse e-mail" }).fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

async function financePage(browser: Browser): Promise<Page> {
  const finance = await createTestUser("candidate", { firstName: "Farida", lastName: "Finance" });
  await grantAdminRole(finance.id, "finance");
  const context = await browser.newContext({ locale: "fr-FR", ...proxy });
  const page = await context.newPage();
  await login(page, finance.email, finance.password);
  return page;
}

async function recruiterWithSubmittedJob(): Promise<{ company: TestCompany; jobId: string }> {
  const company = await createCompany({ verified: true });
  const job = await createDraftJob(company);
  const submitted = await company.owner.client.rpc("submit_job", { p_job_id: job.id });
  if (submitted.error) throw submitted.error;
  expect((await jobRow(job.id)).status).toBe("pending_payment");
  return { company, jobId: job.id };
}

/** Customer on a Stripe test clock (renewals can then be simulated), registered for the company. */
async function clockCustomer(company: TestCompany, label: string) {
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name: `Tamurt Jobs E2E ${label}` });
  const customer = await stripe.customers.create({ name: "Société Test E2E", email: company.owner.email, test_clock: clock.id, metadata: { company_id: company.companyId } });
  const upsert = await serviceClient.rpc("billing_upsert_customer", { p_company_id: company.companyId, p_customer_id: customer.id });
  if (upsert.error) throw upsert.error;
  return { clock, customer };
}

/** What Checkout does once the card is accepted: a subscription on the synced price, with the advert's metadata. */
async function subscribe(customerId: string, card: string, jobId: string, company: TestCompany, behavior: "error_if_incomplete" | "default_incomplete" = "error_if_incomplete") {
  const plan = await defaultPlan();
  if (!plan.stripe_price_id) throw new Error("price not synced");
  const pm = await stripe.paymentMethods.attach(card, { customer: customerId });
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: plan.stripe_price_id }],
    default_payment_method: pm.id,
    payment_behavior: behavior,
    metadata: { job_id: jobId, company_id: company.companyId, plan_id: plan.id },
  });
}

async function advanceClock(clockId: string, to: number) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: to });
  await waitFor("test clock ready", () => stripe.testHelpers.testClocks.retrieve(clockId), (c) => c.status === "ready", 180_000);
}

test.beforeAll(async () => {
  await sql(`update public.countries set is_paid_publishing_enabled = true, is_registration_open = true where code = 'FR'`);
});
test.beforeEach(async () => {
  await resetRateLimits();
});

test("back-office creates the Stripe price; the app opens a Checkout Session at 5,95 € in euros for the advert", async ({ page, browser }) => {
  // Price created from the back-office (finance role), then checked in Stripe.
  let plan = await defaultPlan();
  if (!plan.stripe_price_id) {
    const finance = await financePage(browser);
    await finance.goto("/fr/admin/pricing");
    await finance.getByRole("button", { name: "Créer le prix Stripe" }).first().click();
    plan = await waitFor("price synced", defaultPlan, (p) => p.stripe_price_id !== null, 60_000);
    await finance.context().close();
  }
  const price = await stripe.prices.retrieve(plan.stripe_price_id!);
  expect(price).toMatchObject({ unit_amount: 595, currency: "eur", tax_behavior: "exclusive", active: true });
  expect(price.recurring?.interval).toBe("month");

  // Recruiter: summary, terms, Stripe Checkout.
  const { company, jobId } = await recruiterWithSubmittedJob();
  await login(page, company.owner.email, company.owner.password);
  await page.goto(`/fr/employer/checkout/${jobId}`);
  await expect(page.getByText("5,95 €").first()).toBeVisible();
  const pay = page.getByRole("button", { name: "Payer et publier" });
  await pay.click();
  await expect(page).toHaveURL(new RegExp(`/fr/employer/checkout/${jobId}`)); // terms not accepted: no redirection
  await page.getByRole("checkbox", { name: /conditions commerciales recruteurs/ }).check();
  await pay.click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  await expect(page.getByText(/5,95\s*€/).first()).toBeVisible({ timeout: 30_000 });

  const sessionId = (await subRow(jobId)).stripe_checkout_session_id!;
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  expect(session).toMatchObject({ mode: "subscription", currency: "eur", amount_total: 595, client_reference_id: jobId, status: "open" });
  expect(session.metadata).toMatchObject({ job_id: jobId, company_id: company.companyId, plan_id: plan.id });
  expect(session.line_items?.data[0]?.price?.id).toBe(plan.stripe_price_id);
  expect(session.customer).toBeTruthy();

  // A second attempt expires the first session: no double payment possible.
  await page.goto(`/fr/employer/checkout/${jobId}`);
  await page.getByRole("checkbox", { name: /conditions commerciales recruteurs/ }).check();
  await page.getByRole("button", { name: "Payer et publier" }).click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  expect((await stripe.checkout.sessions.retrieve(sessionId)).status).toBe("expired");
  expect((await jobRow(jobId)).status).toBe("pending_payment");
});

test("card 4242 on a test clock: published, renewed, failed renewal, grace, recovery, cancellation, refund", async ({ page, browser }) => {
  const { company, jobId } = await recruiterWithSubmittedJob();
  const { clock, customer } = await clockCustomer(company, jobId.slice(0, 8));
  try {
    const created = await subscribe(customer.id, "pm_card_visa", jobId, company);
    expect(created.status).toBe("active");

    // Activated only by the webhook events of the real payment.
    await waitFor("job active", () => jobRow(jobId), (j) => j.status === "active");
    const subscriptionId = created.id;
    await waitFor("first payment recorded", () => payments(subscriptionId), (p) => p.length === 1 && p[0].status === "succeeded");
    expect((await subRow(jobId)).status).toBe("active");

    // The recruiter sees it; the advert is public.
    await login(page, company.owner.email, company.owner.password);
    await page.goto("/fr/employer/billing");
    await expect(page.getByText("5,95 €").first()).toBeVisible();
    const [pub] = await sql(`select slug, public_id from public.jobs where id = $1`, [jobId]);
    expect((await page.request.get(`/fr/jobs/${pub.slug}-${pub.public_id}`)).status()).toBe(200);

    // Renewal one month later: a second payment, paid_through moves forward.
    const firstPaidThrough = (await jobRow(jobId)).paid_through!;
    let periodEnd = (await stripe.subscriptions.retrieve(subscriptionId)).items.data[0].current_period_end;
    await advanceClock(clock.id, periodEnd + 2 * 3600);
    await waitFor("renewal paid", () => payments(subscriptionId), (p) => p.filter((x) => x.status === "succeeded").length === 2);
    await waitFor("paid_through extended", () => jobRow(jobId), (j) => new Date(j.paid_through!) > new Date(firstPaidThrough));
    expect((await jobRow(jobId)).status).toBe("active");

    // Next renewal fails (card attached but every charge declined): past_due, grace period, advert still online.
    const failing = await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", { customer: customer.id });
    await stripe.subscriptions.update(subscriptionId, { default_payment_method: failing.id });
    periodEnd = (await stripe.subscriptions.retrieve(subscriptionId)).items.data[0].current_period_end;
    await advanceClock(clock.id, periodEnd + 2 * 3600);
    await waitFor("subscription past_due", () => subRow(jobId), (s) => s.status === "past_due" && s.grace_until !== null);
    expect((await jobRow(jobId)).status).toBe("active");
    const withFailure = await waitFor("failed payment recorded", () => payments(subscriptionId), (p) => p.some((x) => x.status === "failed"));
    // The real decline reason is kept (not a generic code), for the recruiter e-mail and the back-office.
    expect(withFailure.find((x) => x.status === "failed")?.failure_code).toMatch(/decline/);

    // Grace period over: the scheduled maintenance suspends the advert.
    await sql(`update public.subscriptions set grace_until = now() - interval '1 minute' where stripe_subscription_id = $1`, [subscriptionId]);
    const cron = await page.request.get("/api/cron/maintenance", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    expect(cron.status()).toBe(200);
    await waitFor("job suspended", () => jobRow(jobId), (j) => j.status === "suspended" && j.suspension_reason === "payment_failed", 30_000);
    expect((await page.request.get(`/fr/jobs/${pub.slug}-${pub.public_id}`)).status()).not.toBe(200);

    // The customer fixes the card and the open invoice is paid: the advert comes back.
    const good = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
    await stripe.subscriptions.update(subscriptionId, { default_payment_method: good.id });
    const open = await stripe.invoices.list({ subscription: subscriptionId, status: "open", limit: 1 });
    expect(open.data.length).toBe(1);
    await stripe.invoices.pay(open.data[0].id!, { payment_method: good.id });
    await waitFor("job reactivated", () => jobRow(jobId), (j) => j.status === "active");
    expect((await subRow(jobId)).status).toBe("active");

    // Cancellation at period end (what the customer portal does): online until the end, then expired.
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    await waitFor("cancellation recorded", () => subRow(jobId), (s) => s.cancel_at_period_end);
    expect((await jobRow(jobId)).status).toBe("active");
    periodEnd = (await stripe.subscriptions.retrieve(subscriptionId)).items.data[0].current_period_end;
    await advanceClock(clock.id, periodEnd + 3600);
    await waitFor("job expired", () => jobRow(jobId), (j) => j.status === "expired");
    expect((await subRow(jobId)).status).toBe("canceled");

    // Refund of the first payment from the back-office (finance role), through Stripe.
    const admin = await financePage(browser);
    await admin.goto("/fr/admin/payments");
    const first = (await payments(subscriptionId))[0];
    const form = admin.locator("form", { has: admin.locator(`input[name="paymentId"][value="${first.id}"]`) });
    await form.getByRole("textbox", { name: "Motif (10 caractères min.)" }).fill("Test de remboursement E2E en mode test");
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Rembourser" }).click();
    await waitFor("refund recorded", () => payments(subscriptionId), (p) => p[0].amount_refunded === p[0].amount);
    await admin.context().close();
  } finally {
    await stripe.testHelpers.testClocks.del(clock.id).catch(() => undefined);
  }
});

test("3D Secure required: the advert stays unpublished until the payment is really confirmed", async () => {
  const { company, jobId } = await recruiterWithSubmittedJob();
  const { clock, customer } = await clockCustomer(company, `3ds ${jobId.slice(0, 8)}`);
  try {
    const sub = await subscribe(customer.id, "pm_card_authenticationRequired", jobId, company, "default_incomplete");
    expect(sub.status).toBe("incomplete");
    await waitFor("incomplete recorded", () => subRow(jobId), (s) => s?.status === "incomplete");
    expect((await jobRow(jobId)).status).toBe("pending_payment");

    // Once the customer has authenticated, the invoice is paid: then, and only then, the advert goes live.
    const invoiceId = (await stripe.subscriptions.retrieve(sub.id)).latest_invoice as string;
    const good = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
    await stripe.invoices.pay(invoiceId, { payment_method: good.id });
    await waitFor("job active", () => jobRow(jobId), (j) => j.status === "active");
  } finally {
    await stripe.testHelpers.testClocks.del(clock.id).catch(() => undefined);
  }
});

test("card declined (insufficient funds): no subscription, the advert stays unpublished", async () => {
  const { company, jobId } = await recruiterWithSubmittedJob();
  const { clock, customer } = await clockCustomer(company, `declined ${jobId.slice(0, 8)}`);
  try {
    const error = await subscribe(customer.id, "pm_card_visa_chargeDeclinedInsufficientFunds", jobId, company).then(
      () => null,
      (e: Stripe.errors.StripeError) => e,
    );
    expect(error?.code).toBe("card_declined");
    expect(error?.decline_code).toBe("insufficient_funds");
    await new Promise((r) => setTimeout(r, 8000)); // let any webhook arrive
    expect((await jobRow(jobId)).status).toBe("pending_payment");
  } finally {
    await stripe.testHelpers.testClocks.del(clock.id).catch(() => undefined);
  }
});
