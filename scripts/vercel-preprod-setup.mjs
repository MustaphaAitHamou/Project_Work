#!/usr/bin/env node
// Tamurt Jobs — configures the Vercel pre-production project and its Stripe TEST webhook.
// Idempotent: run it again at any time. No secret is ever printed.
//
//   VERCEL_TOKEN=... STRIPE_SECRET_KEY=sk_test_... node scripts/vercel-preprod-setup.mjs \
//     --project tamurt-jobs-preprod --supabase-url https://<ref>.supabase.co [--publishable-key sb_publishable_...]
//
// What it does:
//   1. project settings: Node.js 22, Paris region (cdg1);
//   2. public settings (APP_ENV=preprod, site address, Supabase URL and publishable key,
//      registries, ads in placeholder mode…). Anti-robot (Turnstile) keys are only created
//      when missing, with Cloudflare's public TEST keys: real keys entered by the owner are
//      never replaced;
//   3. generated secrets, stored as "sensitive" (write-only) variables: CRON_SECRET;
//   4. Stripe TEST webhook to /api/stripe/webhook (with Vercel's automation bypass, the site
//      being protected by Vercel Authentication), its signing secret copied straight into
//      STRIPE_WEBHOOK_SECRET;
//   5. writes preprod-access.local.txt (git-ignored): address, automation bypass, CRON_SECRET.
// Secrets it cannot know (Supabase secret key, Stripe test secret key) are listed at the end:
// the owner enters them in Vercel (Settings → Environment Variables), marked Sensitive.
import { randomBytes } from "node:crypto";
import { existsSync, openSync, readFileSync, writeSync, closeSync } from "node:fs";
import Stripe from "stripe";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const projectName = opt("project") ?? "tamurt-jobs-preprod";
const supabaseUrl = opt("supabase-url") ?? "";
const publishableKey = opt("publishable-key");
const ACCESS_FILE = "preprod-access.local.txt";

function stop(message) {
  console.error(`vercel-preprod-setup: ${message}`);
  process.exit(1);
}
if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(supabaseUrl)) stop("--supabase-url https://<ref>.supabase.co is required.");
if (publishableKey && !/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(publishableKey)) stop("--publishable-key must be the PUBLIC key (sb_publishable_…), never a secret key.");
const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
if (stripeKey && !stripeKey.startsWith("sk_test_") && !stripeKey.startsWith("rk_test_")) stop("Stripe TEST key only: pre-production never takes real payments.");

const vercelHeaders = { "content-type": "application/json", ...(process.env.VERCEL_TOKEN ? { authorization: `Bearer ${process.env.VERCEL_TOKEN}` } : {}) };
async function vercel(method, path, body) {
  const res = await fetch(`https://api.vercel.com${path}`, { method, headers: vercelHeaders, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Vercel ${method} ${path}: ${res.status} ${JSON.stringify(json.error ?? json).slice(0, 300)}`);
  return json;
}

// Local, git-ignored access file (KEY=value lines).
const access = new Map();
if (existsSync(ACCESS_FILE)) {
  for (const line of readFileSync(ACCESS_FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) access.set(m[1], m[2]);
  }
}

// 1. Project and its settings.
const project = await vercel("GET", `/v9/projects/${projectName}`);
if (project.nodeVersion !== "22.x" || project.serverlessFunctionRegion !== "cdg1") {
  await vercel("PATCH", `/v9/projects/${project.id}`, { nodeVersion: "22.x", serverlessFunctionRegion: "cdg1" });
}
const domains = await vercel("GET", `/v9/projects/${project.id}/domains`);
const domain = (domains.domains ?? []).find((d) => d.verified && !d.redirect)?.name;
if (!domain) stop("the project has no verified domain yet.");
const siteUrl = `https://${domain}`;
console.log(`project ${project.name} (${project.id}) → ${siteUrl}; Node.js 22, region cdg1`);

// Automation bypass (Vercel Authentication protects every deployment).
let bypass = access.get("VERCEL_AUTOMATION_BYPASS");
if (!bypass) {
  const res = await vercel("PATCH", `/v1/projects/${project.id}/protection-bypass`, { generate: { note: "Tamurt Jobs : webhooks Stripe et tests de recette" } });
  bypass = Object.entries(res.protectionBypass ?? {}).find(([, v]) => v?.scope === "automation-bypass")?.[0];
  if (!bypass) stop("could not create the automation bypass.");
  access.set("VERCEL_AUTOMATION_BYPASS", bypass);
}

// 2–3. Environment variables (production target = the pre-production site).
const existing = new Map(((await vercel("GET", `/v10/projects/${project.id}/env`)).envs ?? []).map((e) => [e.key, e]));
async function setEnv(key, value, type = "plain", { onlyIfMissing = false } = {}) {
  if (onlyIfMissing && existing.has(key)) return "kept";
  await vercel("POST", `/v10/projects/${project.id}/env?upsert=true`, { key, value, type, target: ["production"] });
  return existing.has(key) ? "updated" : "created";
}
const plain = {
  APP_ENV: "preprod",
  NEXT_PUBLIC_SITE_URL: siteUrl,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  REGISTRY_FR_ENABLED: "true",
  REGISTRY_VIES_ENABLED: "true",
  STRIPE_AUTOMATIC_TAX: "false",
  ADS_MODE: "placeholder",
};
if (publishableKey) plain.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey;
for (const [key, value] of Object.entries(plain)) console.log(`  ${key}: ${await setEnv(key, value)}`);
// Anti-robot keys: Cloudflare's documented TEST keys only if nothing is configured yet. Once
// the owner has entered the keys of the real widget, they are kept as they are (never
// overwritten, never printed). The secret is stored as "sensitive" (write-only).
console.log(`  NEXT_PUBLIC_TURNSTILE_SITE_KEY: ${await setEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA", "plain", { onlyIfMissing: true })}`);
console.log(`  TURNSTILE_SECRET_KEY: ${await setEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA", "sensitive", { onlyIfMissing: true })}`);
// E-mails: configured once Resend exists; until then, nothing is sent by the application.
console.log(`  EMAIL_PROVIDER: ${await setEnv("EMAIL_PROVIDER", "none", "plain", { onlyIfMissing: true })}`);

if (!existing.has("CRON_SECRET") || !access.get("CRON_SECRET")) {
  const cron = randomBytes(32).toString("hex");
  await setEnv("CRON_SECRET", cron, "sensitive");
  access.set("CRON_SECRET", cron);
  console.log("  CRON_SECRET: generated (sensitive)");
} else console.log("  CRON_SECRET: kept");

// 4. Stripe TEST webhook.
if (stripeKey) {
  const stripe = new Stripe(stripeKey, { ...(process.env.STRIPE_HTTP_CLIENT === "fetch" ? { httpClient: Stripe.createFetchHttpClient() } : {}) });
  const url = `${siteUrl}/api/stripe/webhook?x-vercel-protection-bypass=${bypass}`;
  const events = [
    "checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired",
    "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed",
    "invoice.created", "invoice.finalized", "invoice.updated", "invoice.paid", "invoice.payment_failed", "invoice.voided", "invoice.marked_uncollectible",
    "refund.created", "refund.updated",
  ];
  const all = [];
  for await (const w of stripe.webhookEndpoints.list({ limit: 100 })) all.push(w);
  const mine = all.find((w) => w.metadata?.app === "tamurt-jobs" && w.metadata?.environment === "preprod");
  // The signing secret is only returned at creation: recreate the endpoint when Vercel lacks it.
  if (mine && existing.has("STRIPE_WEBHOOK_SECRET") && mine.url === url) {
    await stripe.webhookEndpoints.update(mine.id, { enabled_events: events, disabled: false });
    console.log(`  Stripe webhook ${mine.id}: kept (events refreshed)`);
  } else {
    if (mine) await stripe.webhookEndpoints.del(mine.id);
    const created = await stripe.webhookEndpoints.create({
      url,
      enabled_events: events,
      api_version: "2026-10-28.endive",
      description: "Tamurt Jobs — préproduction (mode test)",
      metadata: { app: "tamurt-jobs", environment: "preprod" },
    });
    await setEnv("STRIPE_WEBHOOK_SECRET", created.secret, "sensitive");
    console.log(`  Stripe webhook ${created.id}: created, signing secret stored in Vercel (sensitive)`);
  }
} else console.log("  Stripe webhook: skipped (no STRIPE_SECRET_KEY given to this script)");

// 5. Local access file for the owner and the acceptance tests.
const lines = [
  "Tamurt Jobs — préproduction (NE PAS VERSIONNER, NE PAS PARTAGER)",
  `URL : ${siteUrl}`,
  "Accès humain : connexion Vercel (protection Vercel Authentication sur tous les déploiements).",
  ...[...access].map(([k, v]) => `${k}=${v}`),
];
const fd = openSync(ACCESS_FILE, "w", 0o600);
writeSync(fd, lines.join("\n") + "\n");
closeSync(fd);

const after = new Set(((await vercel("GET", `/v10/projects/${project.id}/env`)).envs ?? []).map((e) => e.key));
const owner = ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "STRIPE_SECRET_KEY"].filter((k) => !after.has(k));
console.log(`vercel-preprod-setup: done; local access file ${ACCESS_FILE} (git-ignored).`);
console.log(owner.length ? `  still missing, to enter in Vercel by the owner: ${owner.join(", ")}` : "  all required variables are present.");
