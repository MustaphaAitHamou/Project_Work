import "server-only";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESUME_BUCKET } from "@/lib/files/resume-storage";
import { detectType } from "@/lib/files/validate";
import { routing } from "@/i18n/routing";
import { buildAnonymizedCv } from "./anonymized-cv";
import { redactionLabels } from "./labels";

export interface CvOwnerAccount {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  locale: string;
}

/**
 * Computes the anonymised draft of a CV version and stores it for the candidate to
 * review (service role; the database re-checks that the version belongs to the user
 * and masks the text a second time). Returns the stored status.
 */
export async function storeAnonymizedDraft(
  owner: CvOwnerAccount,
  versionId: string,
  file: Uint8Array,
  type: "pdf" | "docx",
): Promise<"to_review" | "unavailable"> {
  const admin = createAdminClient();
  const locale = (routing.locales as readonly string[]).includes(owner.locale) ? owner.locale : routing.defaultLocale;
  const [t, { data: profile }] = await Promise.all([
    getTranslations({ locale, namespace: "anonymity" }),
    admin.from("candidate_profiles").select("phone").eq("user_id", owner.id).maybeSingle(),
  ]);
  const draft = await buildAnonymizedCv(
    file,
    type,
    { firstName: owner.firstName, lastName: owner.lastName, email: owner.email, phone: profile?.phone },
    redactionLabels((key) => t(key)),
  );
  const { data, error } = await admin.rpc("resume_store_anonymized_draft", {
    p_user_id: owner.id,
    p_version_id: versionId,
    p_text: draft.text,
    p_summary: draft.counts,
  });
  if (error) throw new Error(`store anonymized draft: ${error.message}`);
  return data === "unavailable" ? "unavailable" : "to_review";
}

/** Same, from the file already stored (CV uploaded before anonymisation existed). */
export async function regenerateAnonymizedDraft(owner: CvOwnerAccount, versionId: string): Promise<"to_review" | "unavailable"> {
  const admin = createAdminClient();
  const { data: version } = await admin
    .from("candidate_resume_versions")
    .select("storage_path, file_deleted_at")
    .eq("id", versionId)
    .eq("user_id", owner.id)
    .maybeSingle();
  if (!version || version.file_deleted_at) throw new Error("version not found");
  const { data: blob, error } = await admin.storage.from(RESUME_BUCKET).download(version.storage_path);
  if (error || !blob) throw new Error(`resume download: ${error?.message}`);
  const buf = new Uint8Array(await blob.arrayBuffer());
  const type = detectType(buf);
  if (type !== "pdf" && type !== "docx") throw new Error("unexpected file type");
  return storeAnonymizedDraft(owner, versionId, buf, type);
}
