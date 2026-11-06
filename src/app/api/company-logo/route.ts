import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkFile } from "@/lib/files/validate";
import { LOGO_BUCKET } from "@/lib/files/resume-storage";
import { rateLimit } from "@/lib/security/rate-limit";

/** Company logo (public bucket). Raster images only: SVG is refused (script injection risk). */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.accountType !== "employer" || user.status !== "active") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await rateLimit(`upload:logo:${user.id}`, 20, 3600))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const supabase = await createClient();
  const { data: member } = await supabase.from("company_members").select("company_id, role").eq("user_id", user.id).maybeSingle();
  if (!member || member.role === "recruiter") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const buf = new Uint8Array(await file.arrayBuffer());
  const check = checkFile(buf, ["png", "jpeg", "webp"], 512 * 1024);
  if (!check.ok) return NextResponse.json({ error: "file_invalid", reason: check.reason }, { status: 422 });
  const path = `${member.company_id}/logo-${check.sha256.slice(0, 16)}.${check.type === "jpeg" ? "jpg" : check.type}`;
  const admin = createAdminClient();
  const up = await admin.storage.from(LOGO_BUCKET).upload(path, buf, { contentType: check.mimeType, upsert: true, cacheControl: "31536000" });
  if (up.error) return NextResponse.json({ error: "generic" }, { status: 500 });
  const { error } = await supabase.from("companies").update({ logo_path: path }).eq("id", member.company_id);
  if (error) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ path }, { status: 201 });
}
