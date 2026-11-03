import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let client: Stripe | null | undefined;

/** Stripe client (API version pinned by the SDK). Null when billing is not configured. */
export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = env().STRIPE_SECRET_KEY;
  client = key ? new Stripe(key, { appInfo: { name: "Tamurt Jobs", url: env().NEXT_PUBLIC_SITE_URL }, maxNetworkRetries: 2, timeout: 20_000 }) : null;
  return client;
}

export function stripeMode(): "live" | "test" | "missing" {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) return "missing";
  return key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "live" : "test";
}

/** Test hook. */
export function setStripeForTests(s: Stripe | null) {
  client = s;
}
