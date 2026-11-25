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

async function newestEventId() {
  const page = await stripe.events.list({ limit: 1 });
  return page.data[0]?.id ?? null;
}

async function eventsAfter(cursor) {
  const out = [];
  let before = cursor;
  for (;;) {
    const page = await stripe.events.list({ limit: 100, ...(before ? { ending_before: before } : {}) });
    if (page.data.length === 0) break;
    out.push(...page.data);
    before = page.data[0].id; // newest of this page
    if (!page.has_more) break;
  }
  // Oldest first, without duplicates.
  const seen = new Set();
  return out
    .sort((a, b) => a.created - b.created)
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

async function forward(event) {
  const payload = JSON.stringify(event, null, 2);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const res = await fetch(target, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": header }, body: payload });
  const text = await res.text();
  console.log(`${new Date().toISOString()} ${event.type} ${event.id} -> ${res.status} ${text.slice(0, 160)}`);
  if (res.status >= 500) throw new Error(`webhook answered ${res.status}`);
}

let cursor = await newestEventId();
const delivered = new Set();
console.log(`stripe-forward-events: forwarding new test events to ${target} (starting after ${cursor ?? "nothing"})`);
const failed = new Map();

for (;;) {
  try {
    const events = await eventsAfter(cursor);
    for (const e of events) {
      if (delivered.has(e.id)) continue;
      try {
        await forward(e);
        delivered.add(e.id);
        failed.delete(e.id);
      } catch (err) {
        // Like Stripe, retry a failed delivery on the next rounds (at most 5 times).
        const n = (failed.get(e.id)?.n ?? 0) + 1;
        if (n <= 5) failed.set(e.id, { n, event: e });
        console.error(`delivery failed (${n}/5): ${e.type} ${e.id}: ${err instanceof Error ? err.message : err}`);
      }
      cursor = e.id;
    }
    for (const { event } of failed.values()) {
      try {
        await forward(event);
        failed.delete(event.id);
      } catch {
        const f = failed.get(event.id);
        if (f && ++f.n > 5) failed.delete(event.id);
      }
    }
  } catch (err) {
    console.error("polling error:", err instanceof Error ? err.message : err);
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}
