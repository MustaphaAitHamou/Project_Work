import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESUME_BUCKET } from "@/lib/files/resume-storage";
import { cancelSubscriptionsAtPeriodEnd } from "@/lib/billing/subscriptions";

/**
 * Right to erasure: anonymises applications, stops renewals, deletes CV files and
 * finally deletes the auth user (cascading to all personal rows).
 */
export async function deleteAccount(userId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("privacy_prepare_account_deletion", { p_user_id: userId });
  if (error) return { ok: false, error: error.message };
  const prep = data as { resume_files: string[]; cancel_subscription_ids: string[] };
  if (prep.resume_files.length) {
    const { error: storageError } = await admin.storage.from(RESUME_BUCKET).remove(prep.resume_files);
    if (storageError) console.error("account deletion: storage cleanup failed", storageError.message);
  }
  await cancelSubscriptionsAtPeriodEnd(prep.cancel_subscription_ids);
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return { ok: false, error: authError.message };
  return { ok: true };
}
