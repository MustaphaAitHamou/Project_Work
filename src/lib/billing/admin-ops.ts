import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getStripe } from "./stripe";

/** Creates (or re-creates) the Stripe Product/Price for a catalogue plan. Prices are immutable in Stripe. */
export async function syncPlanToStripe(planId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("billing_unavailable");
  const admin = createAdminClient();
  const { data: plan, error } = await admin.from("pricing_plans").select("*").eq("id", planId).single();
  if (error || !plan) throw new Error("not_found");
  const productId =
    plan.stripe_product_id ??
    (await stripe.products.create({ name: env().STRIPE_PRODUCT_NAME, metadata: { plan_code: plan.code } }, { idempotencyKey: `product:${plan.id}` })).id;
  const price = await stripe.prices.create(
    {
      product: productId,
      currency: plan.currency.toLowerCase(),
      unit_amount: plan.unit_amount,
      recurring: { interval: "month" },
      tax_behavior: plan.tax_behavior as "exclusive" | "inclusive",
      metadata: { plan_id: plan.id, country: plan.country_code ?? "default" },
    },
    { idempotencyKey: `price:${plan.id}` },
  );
  await admin.rpc("billing_set_plan_stripe_ids", { p_plan_id: plan.id, p_product_id: productId, p_price_id: price.id });
  return { productId, priceId: price.id };
}

/** Administrative refund (justified, audited). The refund row itself is recorded from the refund.* webhook. */
export async function refundPayment(paymentId: string, amountMinor: number | null, reason: string, adminUserId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("billing_unavailable");
  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").select("*").eq("id", paymentId).single();
  if (!payment?.stripe_payment_intent_id || !["succeeded", "partially_refunded"].includes(payment.status)) throw new Error("not_refundable");
  const remaining = payment.amount - payment.amount_refunded;
  const amount = amountMinor ?? remaining;
  if (amount <= 0 || amount > remaining) throw new Error("invalid_amount");
  const refund = await stripe.refunds.create(
    { payment_intent: payment.stripe_payment_intent_id, amount, metadata: { reason: reason.slice(0, 450), requested_by: adminUserId, payment_id: payment.id } },
    { idempotencyKey: `refund:${payment.id}:${amount}:${payment.amount_refunded}` },
  );
  await admin.rpc("billing_record_refund", {
    p: {
      stripe_refund_id: refund.id,
      payment_intent_id: payment.stripe_payment_intent_id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      reason,
      requested_by: adminUserId,
    },
  });
  await admin.from("admin_audit_logs").insert({
    actor_id: adminUserId,
    action: "payment.refund",
    target_type: "payment",
    target_id: payment.id,
    details: { amount, currency: payment.currency, reason, stripe_refund_id: refund.id },
  });
  return refund.id;
}
