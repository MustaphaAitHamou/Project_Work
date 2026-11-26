#!/usr/bin/env node
// Tamurt Jobs — applies the authentication settings of a hosted Supabase project through the
// Management API (token scoped to the project with Auth read-write). Same values as the local
// configuration (supabase/config.toml), with the site address of the environment.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-auth-config.mjs --project-ref <ref> --site-url https://... \
//     [--captcha turnstile-test | --captcha keep] [--dry-run]
//
// --captcha turnstile-test: Cloudflare's public TEST secret (pre-production only).
// --captcha keep (default): leaves the anti-robot setting as it is; in production the owner
// enters the real Turnstile secret in the dashboard (Authentication → Attack protection).
// SMTP (Resend) is not touched: its password is entered by the owner in the dashboard.
import { readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ref = opt("project-ref") ?? "";
const siteUrl = (opt("site-url") ?? "").replace(/\/+$/, "");
const captcha = opt("captcha") ?? "keep";
const dryRun = args.includes("--dry-run");
if (!/^[a-z]{20}$/.test(ref)) throw new Error("--project-ref <20-letter reference> is required");
if (!/^https:\/\/[^/,]+$/.test(siteUrl)) throw new Error("--site-url https://<host> is required");
if (!["keep", "turnstile-test"].includes(captcha)) throw new Error("--captcha keep | turnstile-test");

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const template = (name) => readFileSync(path.join(root, "supabase", "templates", `${name}.html`), "utf8");

const settings = {
  site_url: siteUrl,
  uri_allow_list: `${siteUrl}/**`,
  // Same rules as supabase/config.toml.
  password_min_length: 10,
  password_required_characters: "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
  security_update_password_require_reauthentication: true,
  mailer_autoconfirm: false,
  mailer_secure_email_change_enabled: true,
  mailer_otp_exp: 3600,
  external_anonymous_users_enabled: false,
  mfa_totp_enroll_enabled: true,
  mfa_totp_verify_enabled: true,
  // E-mail templates of the repository (links to {{ .SiteURL }}/auth/confirm?token_hash=…, multilingual).
  mailer_subjects_confirmation: "Tamurt Jobs — Confirm your e-mail / Confirmez votre adresse e-mail",
  mailer_templates_confirmation_content: template("confirmation"),
  mailer_subjects_recovery: "Tamurt Jobs — Reset your password / Réinitialisez votre mot de passe",
  mailer_templates_recovery_content: template("recovery"),
  mailer_subjects_email_change: "Tamurt Jobs — Confirm your new e-mail / Confirmez votre nouvelle adresse",
  mailer_templates_email_change_content: template("email_change"),
  ...(captcha === "turnstile-test"
    ? { security_captcha_enabled: true, security_captcha_provider: "turnstile", security_captcha_secret: "1x0000000000000000000000000000000AA" }
    : {}),
};

const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { "content-type": "application/json", ...(process.env.SUPABASE_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` } : {}) };

if (dryRun) {
  for (const [k, v] of Object.entries(settings)) console.log(`  would set ${k} = ${typeof v === "string" && v.length > 60 ? `${v.slice(0, 57)}…` : JSON.stringify(v)}`);
  process.exit(0);
}
const res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(settings) });
if (!res.ok) throw new Error(`PATCH ${res.status}: ${(await res.text()).slice(0, 400)}`);

// Read back and compare (the captcha secret is never returned in clear and is not compared).
const after = await (await fetch(api, { headers })).json();
const mismatches = Object.keys(settings).filter((k) => k !== "security_captcha_secret" && after[k] !== settings[k]);
console.log(`supabase-auth-config: project ${ref} → ${siteUrl}`);
console.log(`  site_url=${after.site_url}; redirects=${after.uri_allow_list}; password ≥ ${after.password_min_length} (lower, upper, digits)`);
console.log(`  e-mail confirmation required: ${after.mailer_autoconfirm === false}; TOTP: ${after.mfa_totp_enroll_enabled && after.mfa_totp_verify_enabled}; captcha: ${after.security_captcha_enabled ? after.security_captcha_provider : "off"}`);
console.log(`  templates: confirmation, recovery, e-mail change ${mismatches.some((k) => k.startsWith("mailer_")) ? "NOT all applied" : "applied"}`);
if (mismatches.length) {
  console.error(`  mismatches: ${mismatches.join(", ")}`);
  process.exit(1);
}
