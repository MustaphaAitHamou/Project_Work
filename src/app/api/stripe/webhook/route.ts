import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import Stripe from "stripe";
import { env, isProductionDeployment } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, stripeMode } from "@/lib/billing/stripe";
import { processStripeEvent } from "@/lib/billing/webhook";
import { flushOutboxQuietly } from "@/lib/email/outbox";

export const maxDuration = 30;

/**
 * Stripe webhook endpoint. The raw body is verified with the endpoint secret
 * (HMAC-SHA256, timestamp tolerance 300 s) before anything is processed.
 */
export async function POST(request: NextRequest) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  const mode = stripeMode();
  try {
    const result = await processStripeEvent(event, {
      admin: createAdminClient(),
      stripe: getStripe(),
      // Production only accepts live events; other environments accept the mode of their key.
      expectedLivemode: isProductionDeployment() ? true : mode === "missing" ? null : mode === "live",
    });
    after(flushOutboxQuietly);
    return NextResponse.json({ received: true, ...result });
  } catch (e) {
    console.error("stripe webhook processing failed", event.type, event.id, e instanceof Error ? e.message : e);
    // 500 => Stripe retries with exponential backoff (idempotent processing).
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
