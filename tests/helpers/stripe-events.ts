/**
 * Builders for Stripe webhook events shaped like the API version pinned by the SDK
 * (subscription periods on items, invoice subscription under parent.subscription_details).
 * Events are signed with the endpoint secret exactly like Stripe does.
 */
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_local_development_only_not_a_real_secret";
const now = () => Math.floor(Date.now() / 1000);

export function event(type: string, object: Record<string, unknown>, opts: { id?: string; created?: number; livemode?: boolean } = {}) {
  return {
    id: opts.id ?? `evt_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    object: "event",
    api_version: "2026-10-28.endive",
    created: opts.created ?? now(),
    livemode: opts.livemode ?? false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object },
  };
}

export function sign(payload: string, secret = WEBHOOK_SECRET) {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret });
}

export function checkoutSession(o: { sessionId: string; subscriptionId: string; customerId: string; jobId: string; paymentStatus?: string }) {
  return {
    id: o.sessionId,
    object: "checkout.session",
    mode: "subscription",
    payment_status: o.paymentStatus ?? "paid",
    status: "complete",
    subscription: o.subscriptionId,
    customer: o.customerId,
    client_reference_id: o.jobId,
    metadata: { job_id: o.jobId },
    livemode: false,
  };
}

export function subscription(o: { id: string; customerId: string; jobId: string; status: string; periodEnd?: number; cancelAtPeriodEnd?: boolean }) {
  const end = o.periodEnd ?? now() + 30 * 86400;
  return {
    id: o.id,
    object: "subscription",
    customer: o.customerId,
    status: o.status,
    currency: "eur",
    cancel_at_period_end: o.cancelAtPeriodEnd ?? false,
    cancel_at: null,
    canceled_at: o.status === "canceled" ? now() : null,
    ended_at: o.status === "canceled" ? now() : null,
    livemode: false,
    metadata: { job_id: o.jobId },
    items: { object: "list", data: [{ id: "si_x", object: "subscription_item", current_period_start: end - 30 * 86400, current_period_end: end, price: { id: "price_x", unit_amount: 595, currency: "eur" } }] },
  };
}

export function invoice(o: { id: string; subscriptionId: string; customerId: string; status: string; amount?: number; attempt?: number; billingReason?: string; paymentIntent?: string }) {
  const amount = o.amount ?? 595;
  const end = now() + 30 * 86400;
  return {
    id: o.id,
    object: "invoice",
    customer: o.customerId,
    status: o.status,
    billing_reason: o.billingReason ?? "subscription_create",
    currency: "eur",
    subtotal: amount,
    total: amount,
    total_taxes: [],
    amount_due: amount,
    amount_paid: o.status === "paid" ? amount : 0,
    amount_remaining: o.status === "paid" ? 0 : amount,
    attempt_count: o.attempt ?? 1,
    number: `TJ-${o.id.slice(-6).toUpperCase()}`,
    created: now(),
    hosted_invoice_url: "https://invoice.stripe.com/i/test",
    invoice_pdf: "https://pay.stripe.com/invoice/test/pdf",
    livemode: false,
    parent: { type: "subscription_details", quote_details: null, subscription_details: { subscription: o.subscriptionId, metadata: {} } },
    lines: { object: "list", data: [{ id: "il_x", object: "line_item", period: { start: end - 30 * 86400, end } }] },
    payments: o.paymentIntent ? { object: "list", data: [{ id: "inpay_x", object: "invoice_payment", payment: { type: "payment_intent", payment_intent: o.paymentIntent } }] } : undefined,
  };
}

export function refund(o: { id: string; paymentIntent: string; amount: number; reason?: string }) {
  return { id: o.id, object: "refund", amount: o.amount, currency: "eur", status: "succeeded", payment_intent: o.paymentIntent, reason: null, metadata: { reason: o.reason ?? "Test refund" } };
}
