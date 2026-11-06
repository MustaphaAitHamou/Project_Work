#!/usr/bin/env node
// Grants the super_admin role to an EXISTING, active account (created through the
// normal sign-up with a confirmed e-mail and a strong password). There is no default
// or demo administrator: the first administrator is always bootstrapped explicitly.
// Further roles are then managed from the back-office (/admin/users), where every
// change is audited.
//
//   node --env-file=.env.local scripts/grant-admin.mjs someone@example.com
//   node --env-file=.env.production.local scripts/grant-admin.mjs someone@example.com --yes   (non-local)
import { createClient } from "@supabase/supabase-js";

const [email, ...flags] = process.argv.slice(2);
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node --env-file=<env file> scripts/grant-admin.mjs <email> [--yes]");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? "";
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (pass --env-file).");
  process.exit(1);
}
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url);
if (!isLocal && !flags.includes("--yes")) {
  console.error(`Target is NOT local (${url}). Re-run with --yes to grant super_admin there.`);
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: user } = await db.from("users").select("id, status").ilike("email", email).maybeSingle();
if (!user) {
  console.error("No account with this e-mail. Sign up through the website first and confirm the e-mail address.");
  process.exit(1);
}
const { data: authUser } = await db.auth.admin.getUserById(user.id);
if (!authUser?.user?.email_confirmed_at) {
  console.error("The e-mail address of this account is not confirmed yet.");
  process.exit(1);
}
const { error } = await db.rpc("bootstrap_super_admin", { p_email: email });
if (error) {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
}
console.log(`super_admin granted to ${email} (audited as role.bootstrap).`);
