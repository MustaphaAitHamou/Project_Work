/**
 * Stripe webhooks through the real HTTP endpoint (signature verification included).
 * Stripe's servers are not reachable from this environment: events are generated
 * locally and signed with the endpoint secret, exactly as Stripe signs them.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { createCompany, createDraftJob, serviceClient, sql } from "../helpers/supabase";
import { resetRateLimits } from "../helpers/supabase";
import { checkoutSession, event, invoice, refund, sign, subscription } from "../helpers/stripe-events";

async function post(request: APIRequestContext, evt: object, signature?: string) {
  const payload = JSON.stringify(evt);
  return request.post("/api/stripe/webhook", {
    data: payload,
    headers: { "content-type": "application/json", "stripe-signature": signature ?? sign(payload) },
  });
}

async function pendingJob() {
  await sql(`update public.countries set is_paid_publishing_enabled = true where code = 'FR'`);
  const company = await createCompany();
  const job = await createDraftJob(company);
  const submitted = await company.owner.client.rpc("submit_job", { p_job_id: job.id });
  expect(submitted.data).toMatchObject({ status: "pending_payment" });
  const prep = await serviceClient.rpc("billing_prepare_checkout", { p_actor: company.owner.id, p_job_id: job.id });
  const sessionId = `cs_test_${randomUUID().replace(/-/g, "")}`;
  await serviceClient.rpc("billing_register_checkout", { p_job_id: job.id, p_plan_id: (prep.data as { plan: { id: string } }).plan.id, p_session_id: sessionId, p_customer_id: "" });
  return { company, job, sessionId, subscriptionId: `sub_${randomUUID().slice(0, 14)}`, customerId: `cus_${randomUUID().slice(0, 14)}` };
}

const jobStatus = async (id: string) => (await sql(`select status from public.jobs where id = $1`, [id]))[0].status as string;

test.beforeEach(async () => {
  await resetRateLimits();
});

test.describe("Stripe webhook endpoint", () => {
  test("rejects unsigned or tampered payloads without side effects", async ({ request }) => {
    const ctx = await pendingJob();
    const evt = event("checkout.session.completed", checkoutSession({ ...ctx, jobId: ctx.job.id }));
    const res = await post(request, evt, "t=1,v1=deadbeef");
    expect(res.status()).toBe(400);
    const tampered = JSON.stringify(evt);
    const sig = sign(tampered);
    const res2 = await request.post("/api/stripe/webhook", { data: tampered.replace('"paid"', '"paid" '), headers: { "stripe-signature": sig, "content-type": "application/json" } });
    expect(res2.status()).toBe(400);
    expect(await jobStatus(ctx.job.id)).toBe("pending_payment");
  });

  test("the success URL alone never activates; a confirmed payment does, once", async ({ request, page }) => {
    const ctx = await pendingJob();
    // Visiting the return URL does not change anything.
    await page.goto(`/fr/employer/checkout/return?session_id=${ctx.sessionId}`);
    expect(await jobStatus(ctx.job.id)).toBe("pending_payment");

    const unpaid = event("checkout.session.completed", checkoutSession({ ...ctx, jobId: ctx.job.id, paymentStatus: "unpaid" }));
    expect((await post(request, unpaid)).status()).toBe(200);
    expect(await jobStatus(ctx.job.id)).toBe("pending_payment");

    const paid = event("checkout.session.completed", checkoutSession({ ...ctx, jobId: ctx.job.id }));
    const first = await post(request, paid);
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ status: "processed" });
    expect(await jobStatus(ctx.job.id)).toBe("active");

    const duplicate = await post(request, paid);
    expect(await duplicate.json()).toMatchObject({ status: "duplicate" });
    const events = await sql(`select attempts, processed_at from public.stripe_events where id = $1`, [paid.id]);
    expect(events[0].attempts).toBe(2);
  });

  test("renewal failure, grace period, recovery, cancellation and refund", async ({ request }) => {
    const ctx = await pendingJob();
    await post(request, event("checkout.session.completed", checkoutSession({ ...ctx, jobId: ctx.job.id })));
    await post(request, event("customer.subscription.created", subscription({ id: ctx.subscriptionId, customerId: ctx.customerId, jobId: ctx.job.id, status: "active" })));
    const pi = `pi_${randomUUID().slice(0, 14)}`;
    await post(request, event("invoice.paid", invoice({ id: `in_${randomUUID().slice(0, 12)}`, subscriptionId: ctx.subscriptionId, customerId: ctx.customerId, status: "paid", paymentIntent: pi })));
    const [payment] = await sql(`select status, amount from public.payments where stripe_payment_intent_id = $1`, [pi]);
    expect(payment).toMatchObject({ status: "succeeded", amount: 595 });

    // Renewal fails: grace period, the employer is notified, the advert stays online for now.
    const renewal = `in_${randomUUID().slice(0, 12)}`;
    await post(request, event("customer.subscription.updated", subscription({ id: ctx.subscriptionId, customerId: ctx.customerId, jobId: ctx.job.id, status: "past_due" }), { created: Math.floor(Date.now() / 1000) + 5 }));
    const failed = await post(request, event("invoice.payment_failed", invoice({ id: renewal, subscriptionId: ctx.subscriptionId, customerId: ctx.customerId, status: "open", billingReason: "subscription_cycle" })));
    expect(failed.status()).toBe(200);
    expect(await jobStatus(ctx.job.id)).toBe("active");
    const outbox = await sql(`select count(*)::int as n from public.email_outbox where template = 'payment_failed' and dedupe_key like $1`, [`payment_failed:${renewal}%`]);
    expect(outbox[0].n).toBeGreaterThan(0);

    // Retry succeeds.
    await post(request, event("invoice.paid", invoice({ id: renewal, subscriptionId: ctx.subscriptionId, customerId: ctx.customerId, status: "paid", attempt: 2, billingReason: "subscription_cycle" })));
    await post(request, event("customer.subscription.updated", subscription({ id: ctx.subscriptionId, customerId: ctx.customerId, jobId: ctx.job.id, status: "active" }), { created: Math.floor(Date.now() / 1000) + 10 }));
    expect(await jobStatus(ctx.job.id)).toBe("active");

    // Administrative refund recorded from the refund webhook.
    await post(request, event("refund.created", refund({ id: `re_${randomUUID().slice(0, 12)}`, paymentIntent: pi, amount: 595 })));
    const [refunded] = await sql(`select status, amount_refunded from public.payments where stripe_payment_intent_id = $1`, [pi]);
    expect(refunded).toMatchObject({ status: "refunded", amount_refunded: 595 });

    // Subscription ends -> advert expires.
    await post(request, event("customer.subscription.deleted", subscription({ id: ctx.subscriptionId, customerId: ctx.customerId, jobId: ctx.job.id, status: "canceled" }), { created: Math.floor(Date.now() / 1000) + 20 }));
    expect(await jobStatus(ctx.job.id)).toBe("expired");
  });

  test("a renewal invoice for a closed advert is stopped (requires the Stripe API)", async ({ request }) => {
    const ctx = await pendingJob();
    await post(request, event("checkout.session.completed", checkoutSession({ ...ctx, jobId: ctx.job.id })));
    await post(request, event("customer.subscription.created", subscription({ id: ctx.subscriptionId, customerId: ctx.customerId, jobId: ctx.job.id, status: "active" })));
    const activeRenewal = await post(request, event("invoice.created", invoice({ id: `in_${randomUUID().slice(0, 12)}`, subscriptionId: ctx.subscriptionId, customerId: ctx.customerId, status: "draft", billingReason: "subscription_cycle" })));
    expect(await activeRenewal.json()).toMatchObject({ status: "processed", detail: "renewal_allowed" });

    await ctx.company.owner.client.rpc("close_job", { p_job_id: ctx.job.id });
    const stopped = await post(request, event("invoice.created", invoice({ id: `in_${randomUUID().slice(0, 12)}`, subscriptionId: ctx.subscriptionId, customerId: ctx.customerId, status: "draft", billingReason: "subscription_cycle" })));
    // Without Stripe credentials in this environment the cancellation cannot be sent: the
    // endpoint answers 500 so that Stripe retries, and the error is recorded (never silently ignored).
    expect(stopped.status()).toBe(500);
    const [row] = await sql(`select last_error, processed_at from public.stripe_events where type = 'invoice.created' order by received_at desc limit 1`);
    expect(row.last_error).toContain("renewal_guard_requires_stripe");
    expect(row.processed_at).toBeNull();
  });
});
