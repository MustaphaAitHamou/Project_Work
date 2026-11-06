import "server-only";
import Stripe from "stripe";
import type { AdminSupabase } from "@/lib/supabase/admin";

/**
 * Stripe webhook processing (API version pinned by the SDK: subscription periods
 * live on subscription items; an invoice's subscription is in
 * invoice.parent.subscription_details.subscription).
 *
 * Guarantees:
 *  - signature verified by the route before this function is called;
 *  - idempotent: every event id is recorded; an already processed event is skipped;
 *  - a job advert is activated ONLY from confirmed payment events;
 *  - test-mode events are ignored by a live deployment (and vice versa).
 */

export interface WebhookDeps {
  admin: AdminSupabase;
  stripe: Stripe | null;
  /** Expected mode of events ("live" in production). null = accept both (local development/tests). */
  expectedLivemode: boolean | null;
}

export type WebhookResult = { status: "processed" | "duplicate" | "ignored"; detail?: string };

const ts = (v: number | null | undefined) => (v ? new Date(v * 1000).toISOString() : null);
const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

export function mapSubscription(sub: Stripe.Subscription, eventCreated: number) {
  const item = sub.items?.data?.[0];
  const subWithCancelAt = sub as Stripe.Subscription & { cancel_at?: number | null };
  return {
    stripe_subscription_id: sub.id,
    stripe_customer_id: idOf(sub.customer as string | { id: string }),
    status: sub.status,
    cancel_at_period_end: Boolean(sub.cancel_at_period_end || subWithCancelAt.cancel_at),
    canceled_at: ts(sub.canceled_at),
    ended_at: ts(sub.ended_at),
    current_period_start: ts(item?.current_period_start),
    current_period_end: ts(item?.current_period_end),
    price_id: item?.price?.id ?? null,
    unit_amount: item?.price?.unit_amount ?? null,
    currency: sub.currency,
    job_id: sub.metadata?.job_id ?? null,
    company_id: sub.metadata?.company_id ?? null,
    event_created: ts(eventCreated),
    livemode: sub.livemode,
  };
}

export function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const details = inv.parent?.subscription_details;
  return details ? idOf(details.subscription as string | { id: string }) : null;
}

export function mapInvoice(inv: Stripe.Invoice) {
  const line = inv.lines?.data?.[0];
  const tax = (inv.total_taxes ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);
  return {
    stripe_invoice_id: inv.id,
    stripe_subscription_id: invoiceSubscriptionId(inv),
    stripe_customer_id: idOf(inv.customer as string | { id: string }),
    number: inv.number,
    status: inv.status,
    billing_reason: inv.billing_reason,
    currency: inv.currency,
    subtotal: inv.subtotal,
    tax,
    total: inv.total,
    amount_due: inv.amount_due,
    amount_paid: inv.amount_paid,
    amount_remaining: inv.amount_remaining,
    attempt_count: inv.attempt_count,
    hosted_invoice_url: inv.hosted_invoice_url ?? null,
    invoice_pdf: inv.invoice_pdf ?? null,
    period_start: ts(line?.period?.start),
    period_end: ts(line?.period?.end),
    created: ts(inv.created),
  };
}

async function paymentIntentForInvoice(inv: Stripe.Invoice, stripe: Stripe | null): Promise<string | null> {
  const fromPayload = inv.payments?.data?.find((p) => p.payment?.payment_intent)?.payment?.payment_intent;
  if (fromPayload) return idOf(fromPayload as string | { id: string });
  if (!stripe) return null;
  try {
    const list = await stripe.invoicePayments.list({ invoice: inv.id, limit: 3 });
    const pi = list.data.find((p) => p.payment?.payment_intent)?.payment?.payment_intent;
    return pi ? idOf(pi as string | { id: string }) : null;
  } catch {
    return null;
  }
}

async function rpc(deps: WebhookDeps, fn: string, args: Record<string, unknown>) {
  const { data, error } = await deps.admin.rpc(fn as never, args as never);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as unknown;
}

async function handleCheckout(session: Stripe.Checkout.Session, deps: WebhookDeps, event: Stripe.Event) {
  if (session.mode !== "subscription") return "ignored_mode";
  await rpc(deps, "billing_checkout_completed", {
    p: {
      session_id: session.id,
      subscription_id: idOf(session.subscription as string | { id: string }),
      customer_id: idOf(session.customer as string | { id: string }),
      payment_status: event.type === "checkout.session.async_payment_succeeded" ? "paid" : session.payment_status,
      job_id: session.metadata?.job_id ?? session.client_reference_id ?? null,
      livemode: session.livemode,
    },
  });
  return "checkout";
}

async function handleInvoice(inv: Stripe.Invoice, deps: WebhookDeps, kind: "paid" | "failed" | "update") {
  await rpc(deps, "billing_record_invoice", { p: mapInvoice(inv) });
  if (kind === "update") return "invoice_recorded";
  const subId = invoiceSubscriptionId(inv);
  const line = inv.lines?.data?.[0];
  await rpc(deps, "billing_record_payment", {
    p: {
      stripe_invoice_id: inv.id,
      stripe_subscription_id: subId,
      stripe_customer_id: idOf(inv.customer as string | { id: string }),
      attempt_number: Math.max(inv.attempt_count ?? 1, 1),
      payment_intent_id: await paymentIntentForInvoice(inv, deps.stripe),
      amount: kind === "paid" ? inv.amount_paid : inv.amount_due,
      currency: inv.currency,
      status: kind === "paid" ? "succeeded" : "failed",
      failure_code: kind === "failed" ? (inv.last_finalization_error?.code ?? "payment_failed") : null,
      failure_message: kind === "failed" ? (inv.last_finalization_error?.message ?? null) : null,
      period_end: ts(line?.period?.end),
    },
  });
  return `invoice_${kind}`;
}

/** A renewal invoice for an advert that is no longer active must never be charged. */
async function guardRenewal(inv: Stripe.Invoice, deps: WebhookDeps) {
  await rpc(deps, "billing_record_invoice", { p: mapInvoice(inv) });
  if (inv.billing_reason !== "subscription_cycle") return "invoice_recorded";
  const subId = invoiceSubscriptionId(inv);
  if (!subId) return "invoice_recorded";
  const state = (await rpc(deps, "billing_job_state_for_subscription", { p_stripe_subscription_id: subId })) as { job_status: string; cancel_requested: boolean } | null;
  if (!state || (state.job_status === "active" && !state.cancel_requested) || state.job_status === "in_review") return "renewal_allowed";
  if (!deps.stripe) throw new Error("renewal_guard_requires_stripe");
  await deps.stripe.subscriptions.cancel(subId, { invoice_now: false, prorate: false });
  if (inv.status === "draft") await deps.stripe.invoices.del(inv.id);
  else if (inv.status === "open") await deps.stripe.invoices.voidInvoice(inv.id);
  return "renewal_stopped";
}

async function handleRefund(refund: Stripe.Refund, deps: WebhookDeps) {
  await rpc(deps, "billing_record_refund", {
    p: {
      stripe_refund_id: refund.id,
      payment_intent_id: idOf(refund.payment_intent as string | { id: string }),
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      reason: refund.metadata?.reason ?? refund.reason ?? null,
      requested_by: refund.metadata?.requested_by ?? null,
    },
  });
  return "refund_recorded";
}

export async function processStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<WebhookResult> {
  if (deps.expectedLivemode !== null && event.livemode !== deps.expectedLivemode) {
    return { status: "ignored", detail: "livemode_mismatch" };
  }
  const begin = (await rpc(deps, "billing_begin_event", {
    p_id: event.id,
    p_type: event.type,
    p_livemode: event.livemode,
    p_created: ts(event.created),
    p_payload: event as unknown as Record<string, unknown>,
  })) as { already_processed: boolean };
  if (begin.already_processed) return { status: "duplicate" };

  try {
    let detail: string;
    const obj = event.data.object as unknown;
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        detail = await handleCheckout(obj as Stripe.Checkout.Session, deps, event);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const s = obj as Stripe.Checkout.Session;
        const { error } = await deps.admin
          .from("subscriptions")
          .update({ status: "checkout_expired" })
          .eq("stripe_checkout_session_id", s.id)
          .in("status", ["checkout_pending", "incomplete"]);
        if (error) throw new Error(error.message);
        detail = "checkout_expired";
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await rpc(deps, "billing_sync_subscription", { p: mapSubscription(obj as Stripe.Subscription, event.created) });
        detail = "subscription_synced";
        break;
      case "invoice.paid":
        detail = await handleInvoice(obj as Stripe.Invoice, deps, "paid");
        break;
      case "invoice.payment_failed":
        detail = await handleInvoice(obj as Stripe.Invoice, deps, "failed");
        break;
      case "invoice.created":
        detail = await guardRenewal(obj as Stripe.Invoice, deps);
        break;
      case "invoice.finalized":
      case "invoice.updated":
      case "invoice.voided":
      case "invoice.marked_uncollectible":
        detail = await handleInvoice(obj as Stripe.Invoice, deps, "update");
        break;
      case "refund.created":
      case "refund.updated":
        detail = await handleRefund(obj as Stripe.Refund, deps);
        break;
      default:
        detail = "unhandled_type";
    }
    await rpc(deps, "billing_finish_event", { p_id: event.id, p_error: null });
    return { status: "processed", detail };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await deps.admin.rpc("billing_finish_event", { p_id: event.id, p_error: message.slice(0, 1000) });
    throw e;
  }
}
