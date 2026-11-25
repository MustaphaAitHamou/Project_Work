/**
 * Stripe does not guarantee the order of webhook events. Observed with the real
 * Stripe test environment on 25/11/2026: invoice.paid arrived before
 * customer.subscription.created, and the first payment was recorded without its
 * subscription and advert. The adapter now reads the subscription from Stripe first.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { createCompany, createDraftJob, serviceClient, sql } from "../../helpers/supabase";

vi.mock("server-only", () => ({}));

const { processStripeEvent } = await import("@/lib/billing/webhook");

const now = () => Math.floor(Date.now() / 1000);

function fakeStripe(subscription: Stripe.Subscription) {
  return {
    subscriptions: { retrieve: vi.fn(async () => subscription) },
    invoicePayments: { list: vi.fn(async () => ({ data: [] })) },
    paymentIntents: { retrieve: vi.fn() },
  } as unknown as Stripe;
}

describe("Stripe webhook adapter: events out of order", () => {
  it("links a first invoice.paid to its advert even when it arrives before the subscription events", async () => {
    const company = await createCompany({ verified: true });
    await sql(`update public.countries set is_paid_publishing_enabled = true, is_registration_open = true where code = 'FR'`);
    const job = await createDraftJob(company);
    const submitted = await company.owner.client.rpc("submit_job", { p_job_id: job.id });
    expect(submitted.error).toBeNull();

    const run = randomUUID().slice(0, 8);
    const customerId = `cus_order_${run}`;
    const subscriptionId = `sub_order_${run}`;
    const invoiceId = `in_order_${run}`;
    const prep = await serviceClient.rpc("billing_prepare_checkout", { p_actor: company.owner.id, p_job_id: job.id });
    expect(prep.error).toBeNull();
    const plan = (prep.data as { plan: { id: string } }).plan;
    const reg = await serviceClient.rpc("billing_register_checkout", { p_job_id: job.id, p_plan_id: plan.id, p_session_id: `cs_test_order_${run}`, p_customer_id: customerId });
    expect(reg.error).toBeNull();

    const start = now();
    const subscription = {
      id: subscriptionId,
      object: "subscription",
      customer: customerId,
      status: "active",
      currency: "eur",
      cancel_at_period_end: false,
      canceled_at: null,
      ended_at: null,
      livemode: false,
      metadata: { job_id: job.id, company_id: company.companyId, plan_id: plan.id },
      items: { data: [{ current_period_start: start, current_period_end: start + 30 * 86400, price: { id: `price_order_${run}`, unit_amount: 595 } }] },
    } as unknown as Stripe.Subscription;
    const stripe = fakeStripe(subscription);

    const invoice = {
      id: invoiceId,
      object: "invoice",
      customer: customerId,
      status: "paid",
      billing_reason: "subscription_create",
      currency: "eur",
      subtotal: 595,
      total: 595,
      amount_due: 595,
      amount_paid: 595,
      amount_remaining: 0,
      attempt_count: 1,
      number: `ORDER-${run}`,
      created: start,
      parent: { subscription_details: { subscription: subscriptionId } },
      lines: { data: [{ period: { start, end: start + 30 * 86400 } }] },
      payments: { data: [{ payment: { payment_intent: `pi_order_${run}` } }] },
      total_taxes: [],
    } as unknown as Stripe.Invoice;

    const event = (type: string, object: unknown, created = now()) =>
      ({ id: `evt_${type}_${run}`, type, livemode: false, created, data: { object } }) as unknown as Stripe.Event;

    // invoice.paid first.
    const paid = await processStripeEvent(event("invoice.paid", invoice), { admin: serviceClient as never, stripe, expectedLivemode: null });
    expect(paid.status).toBe("processed");
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith(subscriptionId);

    const [payment] = await sql(`select subscription_id, job_id, status, amount from public.payments where stripe_invoice_id = $1`, [invoiceId]);
    expect(payment).toMatchObject({ job_id: job.id, status: "succeeded", amount: 595 });
    expect(payment.subscription_id).not.toBeNull();
    const [jobRow] = await sql(`select status from public.jobs where id = $1`, [job.id]);
    expect(jobRow.status).toBe("active");

    // The subscription event, older, arrives afterwards: nothing is duplicated.
    const late = await processStripeEvent(event("customer.subscription.created", subscription, start - 5), { admin: serviceClient as never, stripe, expectedLivemode: null });
    expect(late.status).toBe("processed");
    const subs = await sql(`select id from public.subscriptions where job_id = $1 and stripe_subscription_id = $2`, [job.id, subscriptionId]);
    expect(subs).toHaveLength(1);
  });
});
