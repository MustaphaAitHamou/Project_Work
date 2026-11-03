import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkFile, sanitizeFilename } from "@/lib/files/validate";
import { purgeResumeFiles, RESUME_BUCKET } from "@/lib/files/resume-storage";
import { rateLimit } from "@/lib/security/rate-limit";
import { UPLOAD_HARD_LIMIT_BYTES } from "@/lib/domain";
import { errorKey } from "@/lib/errors";

export const maxDuration = 30;

/**
 * CV upload: authenticated candidates only. The file is validated server-side
 * (signature, structure, active content) BEFORE being stored in the private bucket.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.accountType !== "candidate" || user.status !== "active") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!(await rateLimit(`upload:resume:${user.id}`, 20, 3600))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const admin = createAdminClient();
  const { data: setting } = await admin.from("platform_settings").select("value").eq("key", "uploads.resume_max_bytes").maybeSingle();
  const maxBytes = Math.min(Number(setting?.value ?? UPLOAD_HARD_LIMIT_BYTES), UPLOAD_HARD_LIMIT_BYTES);

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes + 64 * 1024) return NextResponse.json({ error: "file_invalid", reason: "too_large", maxBytes }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const resumeId = z.uuid().safeParse(form.get("resumeId")).success ? String(form.get("resumeId")) : null;
  const label = String(form.get("label") ?? "").slice(0, 100);

  const buf = new Uint8Array(await file.arrayBuffer());
  const check = checkFile(buf, ["pdf", "docx"], maxBytes);
  if (!check.ok) {
    return NextResponse.json({ error: "file_invalid", reason: check.reason, details: check.details, maxBytes }, { status: 422 });
  }

  const versionId = randomUUID();
  const ext = check.type === "pdf" ? "pdf" : "docx";
  const storagePath = `${user.id}/${versionId}.${ext}`;
  const upload = await admin.storage.from(RESUME_BUCKET).upload(storagePath, buf, { contentType: check.mimeType, upsert: false });
  if (upload.error) {
    console.error("resume upload failed", upload.error.message);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
  const { data, error } = await admin.rpc("resume_register_version", {
    p_user_id: user.id,
    p_resume_id: resumeId as string,
    p_label: label,
    p_version_id: versionId,
    p_storage_path: storagePath,
    p_filename: sanitizeFilename(file.name, ext),
    p_mime_type: check.mimeType!,
    p_size_bytes: check.size,
    p_sha256: check.sha256,
    p_scan_details: { checks: ["signature", ext === "pdf" ? "pdf_active_content" : "docx_structure"], validator: "tamurt-v1" },
  });
  if (error) {
    await admin.storage.from(RESUME_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: errorKey(error) }, { status: error.code === "42501" ? 403 : 400 });
  }
  const result = data as { resume_id: string; version_id: string; purge: { version_id: string; storage_path: string }[] };
  await purgeResumeFiles(result.purge);
  return NextResponse.json({ resumeId: result.resume_id, versionId: result.version_id }, { status: 201 });
}
