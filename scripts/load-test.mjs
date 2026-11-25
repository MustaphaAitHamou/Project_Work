#!/usr/bin/env node
// Tamurt Jobs — simple load test of the public pages (no dependency).
//
//   node scripts/load-test.mjs --base http://localhost:3000 --duration 30 --concurrency 20
//   node scripts/load-test.mjs --base https://preprod.example.com --allow-remote --user user:pass
//
// Sends GET requests in a loop from N parallel "visitors" for D seconds, then prints, for each
// page: requests, errors, latency percentiles (p50, p95, p99, max) and the overall throughput.
// Local targets only, unless --allow-remote is given: a load test on a shared or production
// site must be agreed beforehand.
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = (opt("base", "http://localhost:3000") ?? "").replace(/\/+$/, "");
const durationS = Number(opt("duration", "30"));
const concurrency = Number(opt("concurrency", "20"));
const paths = (opt("paths", "/fr,/fr/jobs,/fr/jobs?q=d%C3%A9veloppeur,/fr/companies,/en,/api/health") ?? "").split(",").filter(Boolean);
const basicAuth = opt("user"); // pre-production protection, "user:password"

const { hostname } = new URL(base);
if (!["localhost", "127.0.0.1"].includes(hostname) && !args.includes("--allow-remote")) {
  console.error(`load-test: ${hostname} is not local. Add --allow-remote once the test has been agreed.`);
  process.exit(2);
}
if (!(durationS > 0 && durationS <= 600) || !(concurrency > 0 && concurrency <= 200)) {
  console.error("load-test: --duration 1..600 seconds, --concurrency 1..200");
  process.exit(2);
}

const headers = { "user-agent": "tamurt-jobs-load-test" };
if (basicAuth) headers.authorization = `Basic ${Buffer.from(basicAuth).toString("base64")}`;

const stats = new Map(paths.map((p) => [p, { latencies: [], errors: 0, statuses: {} }]));
const deadline = Date.now() + durationS * 1000;
let next = 0;

async function visitor() {
  while (Date.now() < deadline) {
    const path = paths[next++ % paths.length];
    const s = stats.get(path);
    const started = performance.now();
    try {
      const res = await fetch(base + path, { headers, redirect: "manual", signal: AbortSignal.timeout(30_000) });
      await res.arrayBuffer();
      s.statuses[res.status] = (s.statuses[res.status] ?? 0) + 1;
      if (res.status >= 500) s.errors++;
    } catch {
      s.errors++;
      s.statuses.network = (s.statuses.network ?? 0) + 1;
    }
    s.latencies.push(performance.now() - started);
  }
}

const pct = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);
const ms = (v) => `${Math.round(v)} ms`;

console.log(`load-test: ${base}, ${concurrency} parallel visitors, ${durationS} s, ${paths.length} pages`);
const t0 = performance.now();
await Promise.all(Array.from({ length: concurrency }, visitor));
const elapsedS = (performance.now() - t0) / 1000;

let total = 0;
let errors = 0;
const rows = [];
for (const [path, s] of stats) {
  const sorted = [...s.latencies].sort((a, b) => a - b);
  total += sorted.length;
  errors += s.errors;
  rows.push({
    page: path,
    requests: sorted.length,
    errors: s.errors,
    p50: ms(pct(sorted, 0.5)),
    p95: ms(pct(sorted, 0.95)),
    p99: ms(pct(sorted, 0.99)),
    max: ms(sorted.at(-1) ?? 0),
    statuses: Object.entries(s.statuses).map(([k, v]) => `${k}×${v}`).join(" "),
  });
}
console.table(rows);
console.log(`total: ${total} requests in ${elapsedS.toFixed(1)} s = ${(total / elapsedS).toFixed(1)} req/s; errors: ${errors} (${((100 * errors) / Math.max(total, 1)).toFixed(2)} %)`);
process.exit(errors > 0 ? 1 : 0);
