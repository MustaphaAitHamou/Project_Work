import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { processEmailOutbox } from "@/lib/email/outbox";

export const maxDuration = 60;

/** Safety net for the transactional outbox (e-mails are normally sent right after each action). */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await processEmailOutbox(100);
  return NextResponse.json(result);
}
