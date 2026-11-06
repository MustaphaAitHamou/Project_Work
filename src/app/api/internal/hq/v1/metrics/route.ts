import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateHqClient } from "@/lib/hq/auth";
import { clientIp } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Tamurt HQ internal API — aggregated platform indicators only.
 *
 * GET /api/internal/hq/v1/metrics?from=2026-10-01&to=2026-11-01
 * Authorization: Bearer tjhq_…
 *
 * The response never contains personal data, CVs or per-company records: only
 * counts and amounts aggregated by currency and by country (see docs/TAMURT_HQ_API.md).
 */
export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 366;
const query = z.object({
  from: z.iso.date().or(z.iso.datetime({ offset: true })).optional(),
  to: z.iso.date().or(z.iso.datetime({ offset: true })).optional(),
});

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra } });
}

export async function GET(request: Request) {
  const ip = await clientIp();
  // Brute-force protection before any database lookup of the token.
  const ipBucket = createHash("sha256").update(ip).digest("hex").slice(0, 24);
  if (!(await rateLimit(`hq:ip:${ipBucket}`, 120, 60))) return json({ error: "rate_limited" }, 429, { "retry-after": "60" });

  const auth = await authenticateHqClient(request.headers.get("authorization"), ip, "metrics:read");
  if (!auth.ok) return json({ error: auth.error }, auth.status, auth.status === 401 ? { "www-authenticate": 'Bearer realm="tamurt-hq"' } : {});
  if (!(await rateLimit(`hq:client:${auth.clientId}`, 60, 60))) return json({ error: "rate_limited" }, 429, { "retry-after": "60" });

  const params = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!params.success) return json({ error: "invalid_parameters" }, 400);
  const to = params.data.to ? new Date(params.data.to) : new Date();
  const from = params.data.from ? new Date(params.data.from) : new Date(to.getTime() - 30 * 86_400_000);
  if (!(from < to) || to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) return json({ error: "invalid_range", max_days: MAX_RANGE_DAYS }, 400);

  const { data, error } = await createAdminClient().rpc("hq_metrics", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (error) {
    console.error("hq metrics failed", error.message);
    return json({ error: "unavailable" }, 503);
  }
  return json({ api_version: "v1", ...(data as Record<string, unknown>) });
}
