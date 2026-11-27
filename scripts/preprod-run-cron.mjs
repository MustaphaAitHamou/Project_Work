#!/usr/bin/env node
// Tamurt Jobs — runs a scheduled job of the PRE-PRODUCTION site on demand (Vercel Hobby runs
// them once a day only). Secured twice: the scheduled-jobs secret (CRON_SECRET) and Vercel's
// automation bypass (the site is protected by Vercel Authentication). Both are read from the
// git-ignored preprod-access.local.txt written by scripts/vercel-preprod-setup.mjs.
//
//   node scripts/preprod-run-cron.mjs maintenance|emails|alerts
import { readFileSync } from "node:fs";

const job = process.argv[2];
if (!["maintenance", "emails", "alerts"].includes(job ?? "")) {
  console.error("usage: node scripts/preprod-run-cron.mjs maintenance|emails|alerts");
  process.exit(2);
}
const access = new Map();
for (const line of readFileSync("preprod-access.local.txt", "utf8").split("\n")) {
  const kv = line.match(/^([A-Z_]+)=(.*)$/);
  if (kv) access.set(kv[1], kv[2]);
  const url = line.match(/^URL : (https:\/\/\S+)$/);
  if (url) access.set("URL", url[1]);
}
const base = access.get("URL") ?? "";
// Pre-production only: never the production site.
if (!/^https:\/\/[a-z0-9-]*preprod[a-z0-9.-]*$/.test(base)) {
  console.error(`preprod-run-cron: ${base || "no URL"} is not a pre-production address.`);
  process.exit(2);
}
const secret = access.get("CRON_SECRET");
const bypass = access.get("VERCEL_AUTOMATION_BYPASS");
if (!secret || !bypass) {
  console.error("preprod-run-cron: CRON_SECRET or VERCEL_AUTOMATION_BYPASS missing from preprod-access.local.txt.");
  process.exit(2);
}
const res = await fetch(`${base}/api/cron/${job}`, {
  headers: { authorization: `Bearer ${secret}`, "x-vercel-protection-bypass": bypass },
  signal: AbortSignal.timeout(120_000),
});
const text = await res.text();
console.log(`preprod-run-cron: ${job} → HTTP ${res.status} ${text.slice(0, 400)}`);
process.exit(res.ok ? 0 : 1);
