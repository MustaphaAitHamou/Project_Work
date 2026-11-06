import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelSubscriptionsAtPeriodEnd } from "@/lib/billing/subscriptions";
import { purgeResumeFiles, VERIFICATION_BUCKET } from "@/lib/files/resume-storage";
import { processEmailOutbox } from "@/lib/email/outbox";

export const maxDuration = 60;

/** Hourly: payment grace periods, deadlines, renewal reconciliation, retention purges. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_maintenance");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const report = data as {
    cancel_subscription_ids: string[];
    resume_files_to_delete: { version_id: string; storage_path: string }[];
    verification_documents_to_delete: { document_id: string; storage_path: string }[];
  } & Record<string, unknown>;
  const renewals = await cancelSubscriptionsAtPeriodEnd(report.cancel_subscription_ids);
  await purgeResumeFiles(report.resume_files_to_delete);
  if (report.verification_documents_to_delete.length) {
    const del = await admin.storage.from(VERIFICATION_BUCKET).remove(report.verification_documents_to_delete.map((d) => d.storage_path));
    if (!del.error) await admin.rpc("verification_documents_mark_deleted", { p_ids: report.verification_documents_to_delete.map((d) => d.document_id) });
  }
  const emails = await processEmailOutbox(50);
  return NextResponse.json({ ...report, renewals_stopped: renewals.done.length, renewals_failed: renewals.failed.length, emails });
}
