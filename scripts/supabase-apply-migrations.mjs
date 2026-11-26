#!/usr/bin/env node
// Tamurt Jobs — applies the repository's migrations to a hosted Supabase project through the
// Management API (no database password needed). Works with a personal access token scoped to
// the project with the Database/Migrations read-write permission.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-apply-migrations.mjs --project-ref <ref> --confirm-ref <ref> [--dry-run]
//
// - The remote history is compared by NAME (file name without .sql): the API records its own
//   version number, so versions cannot be compared. A migration already applied is skipped.
// - Files are applied in order, one request each, with the file name as idempotency key.
// - Stops at the first error: nothing after it is applied.
// - The API refuses large requests: a file over 400 KB made only of simple statements (the
//   generated cities list) is sent in parts cut between statements, recorded as
//   "<name>#part<i>of<n>"; parts already recorded are skipped when the script is run again.
// - supabase/seed.sql is never applied (local development only).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ref = opt("project-ref") ?? "";
const dryRun = args.includes("--dry-run");
if (!/^[a-z]{20}$/.test(ref)) {
  console.error("supabase-apply-migrations: --project-ref <20-letter project reference> is required.");
  process.exit(2);
}
if (opt("confirm-ref") !== ref) {
  console.error("supabase-apply-migrations: repeat the reference with --confirm-ref to confirm the target project.");
  process.exit(2);
}

const api = `https://api.supabase.com/v1/projects/${ref}/database/migrations`;
const headers = { "content-type": "application/json" };
// Behind an HTTPS proxy that injects the token (cloud session), a placeholder is enough.
if (process.env.SUPABASE_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`;

async function call(method, body, extraHeaders = {}) {
  const res = await fetch(api, { method, headers: { ...headers, ...extraHeaders }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) throw new Error(`${method} ${res.status}: ${text.slice(0, 500)}`);
  return json;
}

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "supabase", "migrations");
const files = readdirSync(dir).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();

const MAX_PART = 400 * 1024;

/** One request per file, or several for a large file of simple statements (cut after a line ending with ";"). */
function units(file) {
  const name = file.replace(/\.sql$/, "");
  const query = readFileSync(path.join(dir, file), "utf8");
  if (Buffer.byteLength(query) <= MAX_PART) return [{ name, query }];
  if (query.includes("$$") || /^\s*(do|begin)\b/im.test(query)) {
    throw new Error(`${file} is too large for the API and is not made of simple statements: apply it another way.`);
  }
  const parts = [];
  let current = "";
  for (const statement of query.split(/(?<=;)\n/)) {
    if (current && Buffer.byteLength(current) + Buffer.byteLength(statement) > MAX_PART) {
      parts.push(current);
      current = "";
    }
    current += (current ? "\n" : "") + statement;
  }
  if (current.trim()) parts.push(current);
  return parts.map((q, i) => ({ name: `${name}#part${i + 1}of${parts.length}`, query: q }));
}

const remote = (await call("GET")) ?? [];
const applied = new Set(remote.map((m) => m.name));
const plan = files.flatMap(units).filter((u) => !applied.has(u.name));
console.log(`supabase-apply-migrations: project ${ref}; ${files.length} local files, ${remote.length} recorded remotely, ${plan.length} requests to send${dryRun ? " (dry run)" : ""}`);

for (const { name, query } of plan) {
  const size = `${Math.round(Buffer.byteLength(query) / 1024)} KB`;
  if (dryRun) {
    console.log(`  would apply ${name} (${size})`);
    continue;
  }
  const started = Date.now();
  try {
    await call("POST", { name, query }, { "Idempotency-Key": name });
  } catch (e) {
    console.error(`  FAILED ${name}: ${e instanceof Error ? e.message : e}`);
    console.error("supabase-apply-migrations: stopped; the migrations after this one were not applied.");
    process.exit(1);
  }
  console.log(`  applied ${name} (${size}, ${((Date.now() - started) / 1000).toFixed(1)} s)`);
}

if (!dryRun) {
  const after = (await call("GET")) ?? [];
  const names = new Set(after.map((m) => m.name));
  const missing = files.flatMap(units).map((u) => u.name).filter((n) => !names.has(n));
  console.log(`supabase-apply-migrations: ${after.length} entries recorded remotely; missing: ${missing.length ? missing.join(", ") : "none"}`);
}
