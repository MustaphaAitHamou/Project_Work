#!/usr/bin/env node
// Relays REAL Stripe test-mode events to a local webhook endpoint, signed with the
// local endpoint secret. It plays the role of `stripe listen --forward-to` where
// the Stripe CLI cannot run (no WebSocket through an HTTPS proxy).
//
// The events come from the real Stripe test environment (Checkout, subscriptions,
// invoices, test clocks, refunds); only their delivery is local. The real HTTPS
// delivery and signature are validated on the pre-production endpoint.
//
//   STRIPE_SECRET_KEY=sk_test_...   (or a placeholder when an HTTPS proxy injects the key)
//   STRIPE_WEBHOOK_SECRET=whsec_... (the secret the local app verifies)
//   FORWARD_TO=http://localhost:3000/api/stripe/webhook
//   node scripts/stripe-forward-events.mjs
//
// Refuses live keys: this tool is for test mode only.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const target = process.env.FORWARD_TO ?? "http://localhost:3000/api/stripe/webhook";
const intervalMs = Number(process.env.FORWARD_INTERVAL_MS ?? 1500);

if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("stripe-forward-events: test-mode key required (sk_test_… or rk_test_…).");
  process.exit(1);
}
if (!secret) {
  console.error("stripe-forward-events: STRIPE_WEBHOOK_SECRET is required.");
  process.exit(1);
}

const stripe = new Stripe(key, {
  maxNetworkRetries: 2,
  ...(process.env.STRIPE_HTTP_CLIENT === "fetch" ? { httpClient: Stripe.createFetchHttpClient() } : {}),
});

// Every poll re-reads the last OVERLAP_S seconds of events and skips those already delivered:
// a cursor (ending_before) would miss an event created in the same second as the cursor, or
// one that appears late in the list (seen with invoice.payment_failed after a test clock advance).
const OVERLAP_S = 120;

async function eventsSince(since) {
  const out = [];
  for await (const e of stripe.events.list({ created: { gte: since }, limit: 100 })) out.push(e);
  return out.sort((a, b) => a.created - b.created); // oldest first
}

async function forward(event) {
  const payload = JSON.stringify(event, null, 2);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(target, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });
  const text = await res.text();
  console.log(`${new Date().toISOString()} ${event.type} ${event.id} -> ${res.status} ${text.slice(0, 160)}`);
  if (res.status >= 500) throw new Error(`webhook answered ${res.status}`);
}

const startedAt = Math.floor(Date.now() / 1000);
let since = startedAt;
const delivered = new Set();
console.log(`stripe-forward-events: forwarding new test events to ${target} (created from ${new Date(startedAt * 1000).toISOString()})`);
const failed = new Map();

for (;;) {
  try {
    const pollStartedAt = Math.floor(Date.now() / 1000);
    const events = await eventsSince(Math.max(startedAt, since - OVERLAP_S));
    for (const e of events) {
      if (delivered.has(e.id) || failed.has(e.id)) continue;
      try {
        await forward(e);
        delivered.add(e.id);
      } catch (err) {
        // Like Stripe, retry a failed delivery on the next rounds (at most 5 times).
        failed.set(e.id, { n: 1, event: e });
        console.error(`delivery failed (1/5): ${e.type} ${e.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    since = pollStartedAt;
    for (const [id, f] of failed) {
      try {
        await forward(f.event);
        failed.delete(id);
        delivered.add(id);
      } catch {
        if (++f.n > 5) {
          failed.delete(id);
          delivered.add(id); // given up, like Stripe after its retries: not re-read from the window
          console.error(`delivery abandoned after 5 attempts: ${f.event.type} ${id}`);
        }
      }
    }
  } catch (err) {
    console.error("polling error:", err instanceof Error ? err.message : err);
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}
