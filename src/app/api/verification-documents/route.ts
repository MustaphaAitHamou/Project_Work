import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkFile, sanitizeFilename } from "@/lib/files/validate";
import { VERIFICATION_BUCKET } from "@/lib/files/resume-storage";
import { rateLimit } from "@/lib/security/rate-limit";
import { UPLOAD_HARD_LIMIT_BYTES } from "@/lib/domain";
import { errorKey } from "@/lib/errors";

export const maxDuration = 30;
const DOC_TYPES = ["registry_extract", "authority_proof", "other"] as const;

/** Supporting documents for manual company verification (private bucket, limited retention). */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.accountType !== "employer" || user.status !== "active") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await rateLimit(`upload:verification:${user.id}`, 20, 3600))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const supabase = await createClient();
  const { data: member } = await supabase.from("company_members").select("company_id").eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const file = form.get("file");
  const docType = String(form.get("docType") ?? "other");
  if (!(file instanceof File) || !(DOC_TYPES as readonly string[]).includes(docType)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const buf = new Uint8Array(await file.arrayBuffer());
  const check = checkFile(buf, ["pdf", "png", "jpeg"], UPLOAD_HARD_LIMIT_BYTES);
  if (!check.ok) return NextResponse.json({ error: "file_invalid", reason: check.reason }, { status: 422 });

  const id = randomUUID();
  const ext = check.type === "pdf" ? "pdf" : check.type === "png" ? "png" : "jpg";
  const path = `${member.company_id}/${id}.${ext}`;
  const admin = createAdminClient();
  const up = await admin.storage.from(VERIFICATION_BUCKET).upload(path, buf, { contentType: check.mimeType, upsert: false });
  if (up.error) return NextResponse.json({ error: "generic" }, { status: 500 });
  const { error } = await admin.rpc("verification_register_document", {
    p_actor: user.id,
    p_company_id: member.company_id,
    p: { id, doc_type: docType, storage_path: path, filename: sanitizeFilename(file.name, ext), mime_type: check.mimeType, size_bytes: check.size, sha256: check.sha256 },
  });
  if (error) {
    await admin.storage.from(VERIFICATION_BUCKET).remove([path]);
    return NextResponse.json({ error: errorKey(error) }, { status: 400 });
  }
  return NextResponse.json({ id }, { status: 201 });
}
