import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./stripe";

/**
 * Stops future renewals (no charge for future periods). The current paid period
 * is not refunded automatically; administrators may refund when justified.
 * Failures are retried by the maintenance job (reconciliation).
 */
export async function cancelSubscriptionsAtPeriodEnd(stripeSubscriptionIds: string[]): Promise<{ done: string[]; failed: string[] }> {
  const done: string[] = [];
  const failed: string[] = [];
  const stripe = getStripe();
  if (!stripeSubscriptionIds?.length) return { done, failed };
  if (!stripe) {
    console.error("Stripe not configured: renewal stop deferred to reconciliation", stripeSubscriptionIds);
    return { done, failed: [...stripeSubscriptionIds] };
  }
  const admin = createAdminClient();
  for (const id of new Set(stripeSubscriptionIds)) {
    try {
      const sub = await stripe.subscriptions.update(id, { cancel_at_period_end: true });
      await admin.rpc("billing_mark_cancel_at_period_end", { p_stripe_subscription_id: id, p_value: sub.cancel_at_period_end });
      done.push(id);
    } catch (e) {
      // Already canceled subscriptions cannot be updated: nothing left to stop.
      const code = (e as { code?: string }).code;
      if (code === "resource_missing") done.push(id);
      else {
        console.error("cancel_at_period_end failed", id, e instanceof Error ? e.message : e);
        failed.push(id);
      }
    }
  }
  return { done, failed };
}

export async function resumeRenewal(stripeSubscriptionId: string): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;
  const sub = await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: false });
  await createAdminClient().rpc("billing_mark_cancel_at_period_end", { p_stripe_subscription_id: stripeSubscriptionId, p_value: sub.cancel_at_period_end });
  return !sub.cancel_at_period_end;
}
