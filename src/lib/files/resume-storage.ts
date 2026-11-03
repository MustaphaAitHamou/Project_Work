import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const RESUME_BUCKET = "resumes";
export const VERIFICATION_BUCKET = "verification-documents";
export const LOGO_BUCKET = "company-logos";

/** Deletes CV files that are no longer referenced, then records the purge. */
export async function purgeResumeFiles(entries: { version_id: string; storage_path: string }[]) {
  if (!entries?.length) return;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(RESUME_BUCKET).remove(entries.map((e) => e.storage_path));
  if (error) {
    console.error("resume purge failed", error.message);
    return;
  }
  await admin.rpc("resume_mark_files_deleted", { p_version_ids: entries.map((e) => e.version_id) });
}

/** Short-lived signed download URL (forces download, never rendered on our origin). */
export async function signedDownloadUrl(bucket: string, path: string, filename: string, seconds = 60) {
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUrl(path, seconds, { download: filename });
  if (error || !data) throw new Error(`signed url: ${error?.message}`);
  return data.signedUrl;
}
