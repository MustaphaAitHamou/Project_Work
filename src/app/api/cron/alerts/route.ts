import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { runJobAlerts } from "@/lib/alerts/run";
import { processEmailOutbox } from "@/lib/email/outbox";

export const maxDuration = 60;

/** Daily: job alert digests. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runJobAlerts();
  const emails = await processEmailOutbox(100);
  return NextResponse.json({ ...result, emails });
}
