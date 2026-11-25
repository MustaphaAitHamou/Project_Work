import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createPublicClient } from "@/lib/supabase/public";
import { integrationStatus } from "@/lib/env";
import { getAdsConfig } from "@/lib/ads/config";

/** Liveness + configuration health (never exposes secrets). */
export async function GET(request: NextRequest) {
  // Go-live check of error monitoring: /api/health?monitoring=test with the scheduled-jobs secret sends a test event.
  if (request.nextUrl.searchParams.get("monitoring") === "test") {
    if (!isAuthorizedCron(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return NextResponse.json({ monitoring: "not_configured" }, { status: 503 });
    Sentry.captureMessage("Tamurt Jobs : événement de test de la surveillance des erreurs", "warning");
    const sent = await Sentry.flush(5000);
    return NextResponse.json({ monitoring: sent ? "test_event_sent" : "flush_timeout" }, { headers: { "Cache-Control": "no-store" } });
  }
  let database = "ok";
  try {
    const { error } = await createPublicClient().from("currencies").select("code").limit(1);
    if (error) database = "error";
  } catch {
    database = "error";
  }
  const integrations = integrationStatus();
  const ads = await getAdsConfig().catch(() => null);
  const healthy = database === "ok" && integrations.problems.length === 0;
  return NextResponse.json({ status: healthy ? "ok" : "degraded", database, integrations: { ...integrations, ads: { configured: Boolean(ads?.client), enabled: Boolean(ads?.enabled) } } }, { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
