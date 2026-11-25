import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { integrationStatus } from "@/lib/env";
import { getAdsConfig } from "@/lib/ads/config";

/** Liveness + configuration health (never exposes secrets). */
export async function GET() {
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
